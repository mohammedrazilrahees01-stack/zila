setInterval(async () => {

  const res = await fetch("/api/notifications");
  const data = await res.json();

  if (data.length > 0) {
    const n = data[Math.floor(Math.random() * data.length)];

    const div = document.createElement("div");
    div.innerText = n.text;

    div.style.position = "fixed";
    div.style.bottom = "100px";
    div.style.left = "20px";
    div.style.background = "#000";
    div.style.color = "#fff";
    div.style.padding = "10px 15px";
    div.style.borderRadius = "8px";

    document.body.appendChild(div);

    setTimeout(() => div.remove(), 3000);
  }

}, 5000);