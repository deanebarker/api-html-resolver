import { traverseAndModify } from "./resolver.js";

var deane = {
  name: {
    first: "Deane",
    last: "Barker"
  }
}


function replace(x)
{
  return x.replace(/Deane/g, "Dean");
}


traverseAndModify(deane, "name/first", replace)

console.log(deane);