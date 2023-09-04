import { ViteDevServer, type Plugin } from "vite";
import { readFileSync } from "fs";
import path from "path";
import { getExports } from "./getExports";

export default function workerServicePlugin(): Plugin {
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
          return new Promise((resolve) => {
            const timer = setInterval(() => {
              if ((idr - idp === 1 && idr !== 1) || isDev) {
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
                clearInterval(timer)
                resolve(res);
              }
              //TODO: for dev use hot reload
            }, isDev ? 2000 : 10);
          });
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
      const matches = src.matchAll(
        /import (.*?) from ['"](.*?)\.service(.*?)['"];?\n/g,
      );
      for (const match of matches) {
        usedImports.push({
          members: match[1],
          file: match[2] + ".service" + match[3],
          importer: id,
        });
        res = res.replace(
          match[0],
          `import ${match[1]} from "change-to-worker${match[2]}.service${match[3]}";\n`,
        );
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
