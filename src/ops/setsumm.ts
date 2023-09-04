import { mult, summ } from "../services/summ.service"

export async function setsumm() {
  const span = document.querySelector("#summ")
  if(span) {
    span.innerHTML = String(await summ(10,5)) + String(await mult(2,3))
  }
}
