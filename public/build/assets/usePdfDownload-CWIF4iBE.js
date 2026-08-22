import{r as D}from"./ui-Bmy0jaVP.js";import k from"./html2canvas.esm-CBrSDip1.js";import{E as x}from"./jspdf.es.min-Cp_b5M7g.js";const A=()=>{const[E,g]=D.useState(!1);return{downloadPDF:async(h,v)=>{if(h){g(!0);try{const t=document.createElement("iframe");t.style.position="absolute",t.style.width="1000px",t.style.height="1414px",t.style.left="-9999px",t.style.top="-9999px",t.style.border="none",document.body.appendChild(t);const o=t.contentDocument||t.contentWindow.document,u=h.cloneNode(!0);u.querySelectorAll('[style*="oklch"]').forEach(n=>{const i=(n.getAttribute("style")||"").replace(/oklch\([^\)]+\)/g,"rgb(0, 0, 0)");n.setAttribute("style",i)}),o.open(),o.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Invoice Preview</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #ffffff;
                            font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            -webkit-print-color-adjust: exact;
                        }
                        button, svg, .fixed {
                            display: none !important;
                        }
                    </style>
                </head>
                <body>
                    <div id="print-root" style="width: 900px; margin: 0 auto; background: #ffffff;">
                        ${u.outerHTML}
                    </div>
                </body>
                </html>
            `),o.close(),await new Promise(n=>{const d=Array.from(o.images);let i=0;const b=d.length;if(b===0){setTimeout(n,300);return}const f=()=>{i++,i>=b&&setTimeout(n,300)};d.forEach(m=>{m.complete?f():(m.addEventListener("load",f),m.addEventListener("error",f))})});const p=o.getElementById("print-root");if(!p)throw new Error("Target element not found in iframe");const s=await k(p,{scale:2,useCORS:!0,allowTaint:!0,backgroundColor:"#ffffff",logging:!1,windowWidth:1e3,windowHeight:1414});document.body.removeChild(t);const y=s.toDataURL("image/png",1),e=new x({orientation:"portrait",unit:"mm",format:"a4"}),P=e.internal.pageSize.getWidth(),w=e.internal.pageSize.getHeight(),l=P-10,a=s.height*l/s.width;let r=a,c=0;for(e.addImage(y,"PNG",5,c+5,l,a),r-=w-10;r>0;)c=r-a,e.addPage(),e.addImage(y,"PNG",5,c+5,l,a),r-=w-10;e.save(v)}catch(t){console.error("Error generating PDF:",t)}finally{g(!1)}}},isGeneratingPDF:E}};export{A as u};
