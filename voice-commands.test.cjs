"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parse}=require("./voice-commands.js");

test("recognizes a wake word and accented Spanish library command",()=>{
  assert.equal(parse("Hola Libra, mostrame mi biblioteca").intent,"openLibrary");
});
test("opens the editorial preparation without publishing",()=>{
  assert.equal(parse("LIBRA, preparar mi libro para Amazon KDP").intent,"openEditorial");
});
test("starts dictation only for an explicit recording command",()=>{
  assert.equal(parse("comenzar a grabar").intent,"startRecording");
});
test("recognizes a stop-listening command",()=>{
  assert.equal(parse("detener la escucha").intent,"stopListening");
});
test("does not interpret publishing as an executable command",()=>{
  assert.equal(parse("publicar mi libro ahora"),null);
});
test("does not execute unknown speech",()=>{
  assert.equal(parse("borrá todos mis libros"),null);
});
