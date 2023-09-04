import EventEmitter from "eventemitter3"

const url = new URL("__virtual_worker_file_name", import.meta.url);
const worker = new Worker(url, { type: "module" });

const emitter = new EventEmitter()

worker.addEventListener('message', ({data}) => {
  emitter.emit(data.reqID, data)
})

export default {
  async runtask(op, args) {
    return new Promise((resolve, reject) => {
      const reqID = String(Date.now()) + String(Math.random())
      worker.postMessage({
        reqID,
        op,
        args,
      });
      emitter.once(reqID, (data) => {
        if(data.status === 'ok') {
          resolve(data.result)
        } else {
          reject(data.result)
        }
      })
    });
  },
};
