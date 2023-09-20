# Vite plugin webworker service

**Vite plugin webworker service** is a lightweight, powerful, and easy-to-use tool designed to make working with WebWorkers in your projects as seamless as possible.

The plugin generates a webworker file based on the used files ending in **.service**, as well as a bridge between the main thread and the webworker thread at build time, thereby allowing you to enjoy the reliability of typescript typechecks and various code editor tools, which cannot be achieved by directly using webworkers with postMessage and onmessage

---

## :zap: Features

- **Easy Setup**: Integrate with just a few lines of code.
- **Intuitive API**: No need to dive deep into WebWorkers docs anymore.
- **Compatibility**: Works with major browsers and frameworks.
- **Typed**: No need to write adapter as well as all typescript interfaces to call procedure from webworker.
- **Go definition**: You can jump to the called function (which is not achieved with direct use of webworker).

---

## :comet: Quick Start

1. Install via npm:

   ```sh
   npm install -D vite-plugin-webworker-service
   ```

2. Integrate in your project:

   ```javascript
   //vite.config.ts
   import WebWorkerPlugin from 'vite-plugin-webworker-service';
   
   export default defineConfig({
     plugins: [WebWorkerPlugin()]
   })
   ```
3. vite or vite build

4. Start using it! Check out **Usage** for more detailed examples.

---

## :anchor: Usage

Basic usage:

\*.ts/\*.js
```typescript
import { add } from "some.service.ts"
import { x2state } from "any.service.ts"

const res = await add(1,2)
console.log(res) // 3
await x2state() // state.value === 6
```

[some].**service**.ts
```typescript
import { state } from 'state.ts'

// this function calculate in webworker
export async function add(a: number, b: number) {
    const res = a + b
    state.value = res
    return res
}
```

[any].**service**.ts
```typescript
import { state } from 'state.ts'

// this function calculate in webworker
export async function x2state() {
    state.value = state.value * 2
}
```

state.ts
```typescript
// this is stored in the webworker context because it is imported into .service 
export const state = {
    value: 0
}
```
[any], [some] - any valid names

one **.service** file  can have many exports

exports in **.service** file must be functions(async or classic), 
however, calls to these functions on the main thread always return a Promise.

---

## :mortar_board: License

This project is licensed under the MIT License

---

# CHANGELOG

## 1.1.0

- Added settings, and field **ext** for change **.service** to any file ending

## 1.0.4

- Fixed the way to replace imports, from regular expression to AST parse
