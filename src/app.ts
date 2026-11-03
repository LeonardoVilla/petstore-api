import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

const app = new Hono();
app.use('*', cors());
app.onError((error, c) => { console.error(error); return c.json({message:'Internal server error'},500); });
const sql = () => { if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not configured'); return neon(process.env.DATABASE_URL); };
const parseId = (value:string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const petSchema = z.object({id:z.number().int().positive().optional(),name:z.string().min(1).max(100),photoUrls:z.array(z.string()).default([]),status:z.enum(['available','pending','sold']).default('available')});
const orderSchema = z.object({id:z.number().int().positive().optional(),petId:z.number().int().positive(),quantity:z.number().int().positive().default(1),shipDate:z.string().optional(),status:z.enum(['placed','approved','delivered']).default('placed'),complete:z.boolean().default(false)});
const userSchema = z.object({id:z.number().int().positive().optional(),username:z.string().min(1).max(80),firstName:z.string().optional(),lastName:z.string().optional(),email:z.string().optional(),phone:z.string().optional(),userStatus:z.number().int().optional()});
const petOut=(r:any)=>({id:Number(r.id),name:r.name,photoUrls:r.photo_urls,status:r.status});
const orderOut=(r:any)=>({id:Number(r.id),petId:Number(r.pet_id),quantity:r.quantity,shipDate:r.ship_date,status:r.status,complete:r.complete});
const userOut=(r:any)=>({id:Number(r.id),username:r.username,firstName:r.first_name,lastName:r.last_name,email:r.email,phone:r.phone,userStatus:r.user_status});
const body=async(c:any,schema:z.ZodTypeAny)=>{try{return schema.safeParse(await c.req.json())}catch{return schema.safeParse(null)}};
const params=(name:string)=>[{name,in:'path',required:true,schema:{type:'string'}}];
const response={200:{description:'Sucesso'},400:{description:'Dados inválidos'},404:{description:'Não encontrado'}};
const requestBody=(example:any)=>({required:true,content:{'application/json':{schema:{type:'object',properties:Object.fromEntries(Object.entries(example).map(([key,value])=>[key,{type:Array.isArray(value)?'array':typeof value==='number'?'integer':typeof value}]))},example}}});
const operation=(tag:string,summary:string,method:string,example?:any,parameter?:string)=>({tags:[tag],summary,...(parameter?{parameters:params(parameter)}:{}),...(example?{requestBody:requestBody(example)}:{}),responses:response});
const pet={id:1001,name:'Rex',photoUrls:[],status:'available'};
const order={id:1001,petId:1001,quantity:1,status:'placed',complete:false};
const user={id:1001,username:'aluno1001',firstName:'Aluno'};
app.get('/',c=>c.redirect('/docs'));
app.get('/health',c=>c.json({status:'ok'}));
app.get('/openapi.json',c=>c.json({openapi:'3.0.3',info:{title:'Petstore Didática',version:'1.0.0',description:'API REST educacional com dados fictícios'},servers:[{url:'/'}],tags:[{name:'Pet'},{name:'Store'},{name:'User'}],paths:{
'/pet':{post:operation('Pet','Cadastrar animal','post',pet),put:operation('Pet','Atualizar animal','put',pet)},
'/pet/findByStatus':{get:{tags:['Pet'],summary:'Buscar por status',parameters:[{name:'status',in:'query',schema:{type:'string',enum:['available','pending','sold']}}],responses:response}},
'/pet/{petId}':{get:operation('Pet','Consultar animal','get',undefined,'petId'),delete:operation('Pet','Excluir animal','delete',undefined,'petId')},
'/store/inventory':{get:operation('Store','Inventário','get')},
'/store/order':{post:operation('Store','Criar pedido','post',order)},
'/store/order/{orderId}':{get:operation('Store','Consultar pedido','get',undefined,'orderId'),delete:operation('Store','Excluir pedido','delete',undefined,'orderId')},
'/user':{post:operation('User','Cadastrar usuário','post',user)},
'/user/{username}':{get:operation('User','Consultar usuário','get',undefined,'username'),put:operation('User','Atualizar usuário','put',user,'username'),delete:operation('User','Excluir usuário','delete',undefined,'username')}
}}));
app.get('/docs',swaggerUI({url:'/openapi.json'}));
app.get('/pet/findByStatus',async c=>{const status=c.req.query('status')||'available';if(!['available','pending','sold'].includes(status))return c.json({message:'Invalid status'},400);const rows=await sql()`SELECT * FROM pets WHERE status=${status} ORDER BY id DESC LIMIT 100`;return c.json(rows.map(petOut))});
app.get('/pet/:petId',async c=>{const id=parseId(c.req.param('petId'));if(id===null)return c.json({message:'Invalid ID'},400);const rows=await sql()`SELECT * FROM pets WHERE id=${id}`;return rows[0]?c.json(petOut(rows[0])):c.json({message:'Not found'},404)});
app.post('/pet',async c=>{const p=await body(c,petSchema);if(!p.success)return c.json(p.error.flatten(),400);const v=p.data;const rows=await sql()`INSERT INTO pets (id,name,photo_urls,status) VALUES (COALESCE(${v.id??null},nextval('pets_id_seq')),${v.name},${JSON.stringify(v.photoUrls)}::jsonb,${v.status}) RETURNING *`;return c.json(petOut(rows[0]),201)});
app.put('/pet',async c=>{const p=await body(c,petSchema);if(!p.success)return c.json(p.error.flatten(),400);const v=p.data;if(!v.id)return c.json({message:'id required'},400);const rows=await sql()`UPDATE pets SET name=${v.name},photo_urls=${JSON.stringify(v.photoUrls)}::jsonb,status=${v.status} WHERE id=${v.id} RETURNING *`;return rows[0]?c.json(petOut(rows[0])):c.json({message:'Not found'},404)});
app.delete('/pet/:petId',async c=>{const id=parseId(c.req.param('petId'));if(id===null)return c.json({message:'Invalid ID'},400);const rows=await sql()`DELETE FROM pets WHERE id=${id} RETURNING id`;return rows[0]?c.json({message:'Deleted'}):c.json({message:'Not found'},404)});
app.get('/store/inventory',async c=>{const rows=await sql()`SELECT status,COUNT(*)::int AS count FROM pets GROUP BY status`;return c.json(Object.fromEntries(rows.map(r=>[r.status,r.count])))});
app.post('/store/order',async c=>{const p=await body(c,orderSchema);if(!p.success)return c.json(p.error.flatten(),400);const v=p.data;const rows=await sql()`INSERT INTO orders (id,pet_id,quantity,ship_date,status,complete) VALUES (COALESCE(${v.id??null},nextval('orders_id_seq')),${v.petId},${v.quantity},${v.shipDate??null},${v.status},${v.complete}) RETURNING *`;return c.json(orderOut(rows[0]),201)});
app.get('/store/order/:orderId',async c=>{const id=parseId(c.req.param('orderId'));if(id===null)return c.json({message:'Invalid ID'},400);const rows=await sql()`SELECT * FROM orders WHERE id=${id}`;return rows[0]?c.json(orderOut(rows[0])):c.json({message:'Not found'},404)});
app.delete('/store/order/:orderId',async c=>{const id=parseId(c.req.param('orderId'));if(id===null)return c.json({message:'Invalid ID'},400);const rows=await sql()`DELETE FROM orders WHERE id=${id} RETURNING id`;return rows[0]?c.json({message:'Deleted'}):c.json({message:'Not found'},404)});
app.post('/user',async c=>{const p=await body(c,userSchema);if(!p.success)return c.json(p.error.flatten(),400);const v=p.data;const rows=await sql()`INSERT INTO users (id,username,first_name,last_name,email,phone,user_status) VALUES (COALESCE(${v.id??null},nextval('users_id_seq')),${v.username},${v.firstName??null},${v.lastName??null},${v.email??null},${v.phone??null},${v.userStatus??0}) RETURNING *`;return c.json(userOut(rows[0]),201)});
app.get('/user/:username',async c=>{const rows=await sql()`SELECT * FROM users WHERE username=${c.req.param('username')}`;return rows[0]?c.json(userOut(rows[0])):c.json({message:'Not found'},404)});
app.put('/user/:username',async c=>{const p=await body(c,userSchema);if(!p.success)return c.json(p.error.flatten(),400);const v=p.data;const rows=await sql()`UPDATE users SET username=${v.username},first_name=${v.firstName??null},last_name=${v.lastName??null},email=${v.email??null},phone=${v.phone??null},user_status=${v.userStatus??0} WHERE username=${c.req.param('username')} RETURNING *`;return rows[0]?c.json(userOut(rows[0])):c.json({message:'Not found'},404)});
app.delete('/user/:username',async c=>{const rows=await sql()`DELETE FROM users WHERE username=${c.req.param('username')} RETURNING id`;return rows[0]?c.json({message:'Deleted'}):c.json({message:'Not found'},404)});
export default app;
