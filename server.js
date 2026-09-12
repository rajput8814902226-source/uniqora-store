const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const productsFile = path.join(DATA, "products.json");
const ordersFile = path.join(DATA, "orders.json");
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA,{recursive:true});
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile,"[]");

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(ROOT,"public")));

const readJSON = f => JSON.parse(fs.readFileSync(f,"utf8"));
const writeJSON = (f,d) => fs.writeFileSync(f,JSON.stringify(d,null,2));

function admin(req,res,next){
  const token=req.headers["x-admin-token"];
  if(!token || token !== (process.env.ADMIN_PASSWORD || "change-this-password"))
    return res.status(401).json({error:"Unauthorized"});
  next();
}

app.get("/api/products",(req,res)=>res.json(readJSON(productsFile)));

app.post("/api/orders",async(req,res)=>{
  try{
    const {items,customer,paymentMethod="cod"}=req.body;
    if(!Array.isArray(items)||!items.length||!customer?.name||!customer?.phone||!customer?.address)
      return res.status(400).json({error:"Please provide products and complete delivery details."});
    const products=readJSON(productsFile);
    let total=0, normalized=[];
    for(const item of items){
      const p=products.find(x=>x.id===Number(item.id));
      const qty=Math.max(1,Number(item.qty)||1);
      if(!p) return res.status(400).json({error:"Product not found"});
      if(qty>p.stock) return res.status(400).json({error:`Only ${p.stock} left for ${p.name}`});
      total += p.price*qty;
      normalized.push({id:p.id,name:p.name,price:p.price,qty});
    }

    if(paymentMethod==="razorpay"){
      if(!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
        return res.status(503).json({error:"Razorpay is not configured."});
      const order={id:"UQ"+Date.now().toString(36).toUpperCase(),items:normalized,customer,total,paymentMethod,status:"Payment Pending",createdAt:new Date().toISOString()};
      const razorpay=new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
      const rz=await razorpay.orders.create({amount:total*100,currency:"INR",receipt:order.id});
      order.razorpayOrderId=rz.id;
      const orders=readJSON(ordersFile);orders.unshift(order);writeJSON(ordersFile,orders);
      return res.json({orderId:order.id,razorpayOrderId:rz.id,amount:total*100,keyId:process.env.RAZORPAY_KEY_ID});
    }

    const order={id:"UQ"+Date.now().toString(36).toUpperCase(),items:normalized,customer,total,paymentMethod,status:"Pending",createdAt:new Date().toISOString()};
    const orders=readJSON(ordersFile);orders.unshift(order);writeJSON(ordersFile,orders);
    const updated=products.map(p=>{const it=normalized.find(x=>x.id===p.id); return it?{...p,stock:Math.max(0,p.stock-it.qty)}:p});
    writeJSON(productsFile,updated);
    res.json({orderId:order.id,total});
  }catch(err){
    console.error("Order error",err);
    res.status(500).json({error:"Unable to create order. Please try again."});
  }
});

app.post("/api/payment/verify",(req,res)=>{
  const {orderId,razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;
  const orders=readJSON(ordersFile), order=orders.find(x=>x.id===orderId);
  if(!order) return res.status(404).json({error:"Order not found"});
  if(!order.razorpayOrderId || order.razorpayOrderId!==razorpay_order_id)
    return res.status(400).json({error:"Payment order mismatch"});
  const expected=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET||"").update(order.razorpayOrderId+"|"+razorpay_payment_id).digest("hex");
  if(expected!==razorpay_signature) return res.status(400).json({error:"Payment verification failed"});
  if(order.status!=="Paid"){
    const products=readJSON(productsFile);
    for(const it of order.items){
      const p=products.find(x=>x.id===it.id);
      if(!p || it.qty>p.stock) return res.status(409).json({error:`Stock changed for ${it.name}. Please contact us for assistance.`});
    }
    for(const it of order.items){
      const p=products.find(x=>x.id===it.id);
      p.stock=Math.max(0,p.stock-it.qty);
    }
    writeJSON(productsFile,products);
    order.status="Paid";
    order.razorpayPaymentId=razorpay_payment_id;
    order.paidAt=new Date().toISOString();
    writeJSON(ordersFile,orders);
  }
  res.json({ok:true,orderId:order.id});
});

app.get("/api/admin/orders",admin,(req,res)=>res.json(readJSON(ordersFile)));
app.put("/api/admin/orders/:id",admin,(req,res)=>{
  const orders=readJSON(ordersFile), i=orders.findIndex(x=>x.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Order not found"});
  orders[i].status=req.body.status||orders[i].status; writeJSON(ordersFile,orders); res.json(orders[i]);
});
app.post("/api/admin/products",admin,(req,res)=>{
  const p=readJSON(productsFile), item={...req.body,id:Date.now(),price:Number(req.body.price),compareAt:Number(req.body.compareAt||0),stock:Number(req.body.stock||0)};
  p.push(item); writeJSON(productsFile,p); res.json(item);
});
app.put("/api/admin/products/:id",admin,(req,res)=>{
  const p=readJSON(productsFile),i=p.findIndex(x=>x.id===Number(req.params.id));
  if(i<0)return res.status(404).json({error:"Product not found"});
  p[i]={...p[i],...req.body,id:p[i].id,price:Number(req.body.price??p[i].price),stock:Number(req.body.stock??p[i].stock)};
  writeJSON(productsFile,p);res.json(p[i]);
});
app.delete("/api/admin/products/:id",admin,(req,res)=>{
  writeJSON(productsFile,readJSON(productsFile).filter(x=>x.id!==Number(req.params.id)));res.json({ok:true});
});

app.get("/{*splat}",(req,res)=>res.sendFile(path.join(ROOT,"public","index.html")));
app.listen(PORT,()=>console.log(`UNIQORA running at http://localhost:${PORT}`));