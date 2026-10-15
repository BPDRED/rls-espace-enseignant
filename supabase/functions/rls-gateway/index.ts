import {createHandler} from './core.mjs';
Deno.serve(createHandler(Deno.env.toObject()));
