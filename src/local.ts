import { serve } from '@hono/node-server';
import app from './app';
serve({fetch:app.fetch,port:Number(process.env.PORT||3000)});
console.log('http://localhost:3000/docs');
