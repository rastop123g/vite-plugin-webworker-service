import { helloWorld } from "../services/hello_world.service";

export async function anotherOps() {
  console.log(await helloWorld())
}
