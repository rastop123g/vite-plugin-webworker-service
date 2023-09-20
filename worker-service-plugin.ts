import { ViteDevServer, type Plugin } from "vite";
import { readFileSync } from "fs";
import path from "path";
import { getExports } from "./getExports";
import { fileURLToPath } from "url";
import { ImportDeclaration, Program } from "./types/ast";
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export default function workerServicePlugin(settings: Settings = defaultSettings): Plugin {
  const workerName = `virtual-webworker-${Date.now()}.js`;
  let idr = 0;
  let idp = 0;
  let server: ViteDevServer | null = null;
  let exportsInService: {
    [key: string]: string[];
  } = {};
  let isDev = true;
  let callResolve: any[] = [];
  let usedImports: {
    members: string;
    file: string;
    importer: string;
  }[] = [];
  return {
    name: "vite-config-worker-service",
    options() {
      if (process.env.NODE_ENV === "development") {
        isDev = true;
      } else if (process.env.NODE_ENV === "production") {
        isDev = false;
      }
    },
    configureServer(_server) {
      //dev only
      server = _server;
    },
    resolveId: {
      order: "pre",
      async handler(source, importer, options) {
        if (source.startsWith("change-to-worker")) {
          const origs = source.replace("change-to-worker", "");
          const resolution = await this.resolve(origs, importer, {
            skipSelf: true,
            ...options,
          });
          const replacedID = `front-service-${JSON.stringify(resolution)}`;
          if (isDev) {
            callResolve.push(resolution);
            const res = await server?.transformRequest(
              resolution?.id as string,
            );
            if (res?.code) {
              const ast = this.parse(res.code);
              const exps = getExports(ast);
              exportsInService[replacedID] = exps;
            }
            const mod = server?.moduleGraph.getModuleById(workerName);
            if (mod) {
              server?.reloadModule(mod);
            }
          } else {
            if (!resolution || resolution.external) return resolution;
            const info = await this.load(resolution);
            exportsInService[replacedID] = info.exports || [];
          }
          return {
            id: replacedID,
            moduleSideEffects: true,
          };
        } else if (source === "thread:main:worker-adapter") {
          return {
            id: "thread:main:worker-adapter",
            moduleSideEffects: true,
          };
        } else if (source.includes(workerName)) {
          return {
            id: source,
            moduleSideEffects: true,
          };
        }
      },
    },
    load: {
      order: "pre",
      async handler(id) {
        idr++;
        if (id.startsWith("front-service-")) {
          let res = `import frw from "thread:main:worker-adapter"\n`;
          if (exportsInService[id]) {
            for (const exp of exportsInService[id]) {
              res += `export function ${exp}(...args) {
                          return frw.runtask('${exp}', args)
                        }\n`;
            }
          }
          return res;
        }
        if (id === "thread:main:worker-adapter") {
          let res = readFileSync(path.resolve(__dirname, "src/frontWorker.js"));
          return res.toString();
        } else if (id.includes(workerName)) {
          if (!isDev) {
            return new Promise((resolve) => {
              const timer = setInterval(() => {
                if (idr - idp === 1 && idr !== 1) {
                  let res = readFileSync(
                    path.resolve(__dirname, "src/backWorker.js"),
                  ).toString();
                  res += "\n";
                  for (const key in exportsInService) {
                    const filepath = JSON.parse(
                      key.replace("front-service-", ""),
                    ).id;
                    const importStr = `import {${exportsInService[key].join(
                      ",",
                    )}} from "${filepath}"\n`;
                    res += importStr;
                    for (const exp of exportsInService[key]) {
                      res += `adapter.register("${exp}",${exp})\n`;
                    }
                  }
                  clearInterval(timer);
                  resolve(res);
                }
              }, 10);
            });
          } else {
            let res = readFileSync(
              path.resolve(__dirname, "src/backWorker.js"),
            ).toString();
            res += "\n";
            for (const key in exportsInService) {
              const filepath = JSON.parse(key.replace("front-service-", "")).id;
              const importStr = `import {${exportsInService[key].join(
                ",",
              )}} from "${filepath}"\n`;
              res += importStr;
              for (const exp of exportsInService[key]) {
                res += `adapter.register("${exp}",${exp})\n`;
              }
            }
            return res;
          }
        }
      },
    },
    buildStart() {
      if (!isDev) {
        this.emitFile({
          id: workerName,
          type: "chunk",
          name: workerName,
          fileName: workerName,
        });
      }
    },
    transform(src, id) {
      if (id.includes(workerName)) {
        return {
          code: src,
          map: null,
        };
      }
      if (id === "thread:main:worker-adapter") {
        return {
          code: src.replace("__virtual_worker_file_name", workerName),
          map: null,
        };
      }
      let res = src;
      try {
        const ast = this.parse(src);
        const imports = getImportsfromAST(ast as Program);
        if (imports.length > 0) {
          for (const imp of imports) {
            if (
              imp.file &&
              new RegExp("\\."+settings.ext+"(\\.ts|\\.js|)[\"']$").test(imp.file)
            ) {
              usedImports.push({
                members: `{${imp.members.join(",")}}`,
                file: imp.file,
                importer: id,
              });
              res = res.replace(
                imp.file,
                `"change-to-worker${imp.file
                  .replace(/"/g, "")
                  .replace(/;/g, "")}";`,
              );
            }
          }
        }
      } catch {
        // not parse ast
      }
      return {
        code: res,
        map: null,
      };
    },
    moduleParsed() {
      idp++;
    },
  };
}

function getImportsfromAST(ast: Program) {
  const body = ast.body;
  const imports = body.filter(
    (node) => node.type === "ImportDeclaration",
  ) as ImportDeclaration[];
  const res = imports.map((entry: ImportDeclaration) => {
    return {
      file: entry.source.raw,
      members: entry.specifiers.map((item) => {
        return item.local.name;
      }),
    };
  });
  return res;
}

interface Settings {
  ext: string
}

const defaultSettings: Settings = {
  ext: "service"
}
