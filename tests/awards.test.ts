import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Awards from '../app/components/Awards';
import type {Result} from '../lib/engine';
for(let n=2;n<=16;n++)test(`${n}-bottle awards render the actual winner and last-place bottle`,()=>{const results:Result[]=Array.from({length:n},(_,i)=>({bottleId:`b${i+1}`,place:i+1,tier:'final',score:100-i,preference:100-i,enjoyment:50,stages:{final:100-i}}));const html=renderToStaticMarkup(createElement(Awards,{results,label:id=>`Bottle ${id}`}));assert.match(html,/<h2>Bottle b1<\/h2>/);assert.ok(html.includes(`<h2>Bottle b${n}</h2>`));assert.equal((html.match(/<h2>/g)??[]).length,2)});
