setInterval(() => {

  const products = ["Hoodie", "T-Shirt", "Oversized Tee", "Cargo Pants"];
  const names = ["Ali", "Omar", "Zaid", "Rahul", "Arjun"];

  const text = `${names[Math.floor(Math.random()*names.length)]} just bought ${products[Math.floor(Math.random()*products.length)]}`;

  const div = document.createElement("div");
  div.innerText = text;

  div.style.position = "fixed";
  div.style.bottom = "120px";
  div.style.left = "20px";
  div.style.background = "#111";
  div.style.color = "#fff";
  div.style.padding = "10px 15px";
  div.style.borderRadius = "8px";
  div.style.fontSize = "12px";

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 4000);

}, 7000);