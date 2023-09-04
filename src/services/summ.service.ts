import { wl } from "../utils/workloger"

export async function summ(a:number, b: number) {
  console.log('summab', a,b)
  wl()
  return a + b
}

export async function mult(a:number, b: number) {
  console.log('multab', a,b)
  wl()
  return a * b
}

export async function getPage() {
  return await fetch('/').then(res => res.text())
}
