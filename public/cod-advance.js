// UNIQORA COD advance checkout: ₹100 online, remaining amount on delivery.
(function(){
  const COD_ADVANCE=100;

  window.checkout=function(){
    if(!cart.length)return alert('Your cart is empty');
    const total=cart.reduce((sum,x)=>{const p=products.find(p=>p.id===x.id);return sum+(p?p.price*x.qty:0)},0);
    const advance=Math.min(COD_ADVANCE,total), balance=Math.max(0,total-advance);
    $('#modal').classList.add('open');
    $('#box').innerHTML=`<h2>Checkout</h2><form class="form" onsubmit="place(event)"><input name="name" placeholder="Full name" required><input name="phone" pattern="[0-9]{10}" placeholder="10-digit mobile number" required><input name="email" type="email" placeholder="Email"><textarea name="address" rows="3" placeholder="Full delivery address" required></textarea><input name="city" placeholder="City" required><input name="pincode" pattern="[0-9]{6}" placeholder="Pincode" required><b>Payment Method</b><div class="pay-choice"><label class="pay-option"><input type="radio" name="paymentMethod" value="cod" checked onchange="updateCodSummary()"> COD — ₹100 Advance</label><label class="pay-option"><input type="radio" name="paymentMethod" value="razorpay" onchange="updateCodSummary()"> Pay Full Online</label></div><div id="codSummary" style="padding:14px;border:1px solid #e7dfd3;border-radius:14px;background:#faf8f4;line-height:1.7"><b>Cash on Delivery</b><br>Order total: ${money(total)}<br>Pay now: <b>${money(advance)}</b><br>Pay on delivery: <b>${money(balance)}</b><br><small>₹100 advance is adjusted in your order total.</small></div><div class="secure-note">Advance and online payments are processed securely through Razorpay.</div><button class="btn">Continue to Payment</button><button type="button" class="btn light" onclick="closeModal()">Cancel</button></form>`;
  };

  window.updateCodSummary=function(){
    const method=document.querySelector('input[name="paymentMethod"]:checked')?.value||'cod';
    const el=document.getElementById('codSummary');if(!el)return;
    const total=cart.reduce((sum,x)=>{const p=products.find(p=>p.id===x.id);return sum+(p?p.price*x.qty:0)},0);
    const advance=Math.min(COD_ADVANCE,total), balance=Math.max(0,total-advance);
    el.innerHTML=method==='cod'?`<b>Cash on Delivery</b><br>Order total: ${money(total)}<br>Pay now: <b>${money(advance)}</b><br>Pay on delivery: <b>${money(balance)}</b><br><small>₹100 advance is adjusted in your order total.</small>`:`<b>Pay Full Online</b><br>Pay now: <b>${money(total)}</b><br>Pay on delivery: <b>₹0</b>`;
  };

  window.place=async function(e){
    e.preventDefault();let btn=e.submitter;if(btn){btn.disabled=true;btn.textContent='Please wait...'}
    try{
      let f=Object.fromEntries(new FormData(e.target));let paymentMethod=f.paymentMethod||'cod';
      f.address=`${f.address}, ${f.city} - ${f.pincode}`;delete f.city;delete f.pincode;delete f.paymentMethod;
      let r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,customer:f,paymentMethod})}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Order failed');
      await loadRazorpay();
      const isCOD=paymentMethod==='cod';
      let options={key:d.keyId,amount:d.amount,currency:'INR',name:'UNIQORA',description:isCOD?'₹100 COD Advance — '+d.orderId:'UNIQORA Order '+d.orderId,order_id:d.razorpayOrderId,prefill:{name:f.name,contact:f.phone,email:f.email||''},theme:{color:'#17130f'},handler:async function(resp){
        let vr=await fetch('/api/payment/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:d.orderId,...resp})}),vd=await vr.json();
        if(!vr.ok)return alert(vd.error||'Payment verification failed. Please contact support with Order ID '+d.orderId);
        cart=[];save();closeModal();closeCart();
        alert(isCOD?`COD order confirmed! ₹${vd.advanceAmount} advance paid. ₹${vd.balanceDue} payable on delivery. Order ID: ${d.orderId}`:`Payment successful! Order ID: ${d.orderId}`);
        location.hash='#/';
      }};
      let rz=new Razorpay(options);rz.on('payment.failed',function(){alert(isCOD?'₹100 advance payment was not completed. COD order is not confirmed yet.':'Payment was not completed. You can retry from checkout.')});rz.open();
    }catch(err){alert(err.message||'Something went wrong')}finally{if(btn){btn.disabled=false;btn.textContent='Continue to Payment'}}
  };
})();