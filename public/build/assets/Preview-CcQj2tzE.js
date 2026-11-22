import{r as c,j as r}from"./ui-KsqjVDMd.js";import{y as _,K as b,ah as h,p as k}from"./app-TzmP5wFm.js";import{NewYork as v}from"./NewYork-_WLPKniq.js";import{Toronto as g}from"./Toronto-ulohqlSK.js";import{Rio as T}from"./Rio-DAP8XPOt.js";import{London as P}from"./London-CYvDo6Rc.js";import{Istanbul as A}from"./Istanbul-DYihtmkU.js";import{Mumbai as D}from"./Mumbai-Po-bkc6f.js";import{HongKong as I}from"./HongKong-DSfylTVH.js";import{Tokyo as L}from"./Tokyo-D4B5JA5Y.js";import{Sydney as R}from"./Sydney-CMht9_04.js";import{Paris as C}from"./Paris-C_7lqhvG.js";import{u as E}from"./usePdfDownload-DxIOGpnB.js";import{f as N}from"./currency-kzm_C5pv.js";import"./vendor-B1hewrmX.js";import"./utils-DBYZG17H.js";import"./QRCodeGenerator-BJrkCtjk.js";import"./html2canvas.esm-CBrSDip1.js";import"./jspdf.es.min-BESTdpak.js";function oo(){const{t:i}=_(),{invoice:e,invoiceSettings:o}=b().props,{logoDark:m}=h(),n=c.useRef(null),{downloadPDF:p}=E(),l=(o==null?void 0:o.invoice_qr_display)==="true"||(o==null?void 0:o.invoice_qr_display)===!0,u=(o==null?void 0:o.invoice_footer_title)||"",d=(o==null?void 0:o.invoice_footer_notes)||"",a=(o==null?void 0:o.invoice_template)||"london",f=(o==null?void 0:o.invoice_color)||"#3b82f6",x=o!=null&&o.invoice_logo&&o.invoice_logo.trim()!==""?o.invoice_logo:m,y=s=>N(s);c.useEffect(()=>{const s=setTimeout(()=>{j()},1500);return()=>clearTimeout(s)},[]);const j=async()=>{n.current&&(await p(n.current,`Invoice-${e.invoice_number}.pdf`),window.close())},t={invoice:e,color:f,showQr:l,invoiceUrl:route("invoices.payment",e.payment_token),footerTitle:u,footerNotes:d,remainingAmount:e.balance_due,formatAmount:y,t:i,companyLogo:x},w=()=>{switch(a==null?void 0:a.toLowerCase()){case"new_york":return r.jsx(v,{...t});case"toronto":return r.jsx(g,{...t});case"rio":return r.jsx(T,{...t});case"istanbul":return r.jsx(A,{...t});case"mumbai":return r.jsx(D,{...t});case"hong_kong":return r.jsx(I,{...t});case"tokyo":return r.jsx(L,{...t});case"sydney":return r.jsx(R,{...t});case"paris":return r.jsx(C,{...t});case"london":default:return r.jsx(P,{...t})}};return r.jsxs(r.Fragment,{children:[r.jsxs(k,{children:[r.jsx("title",{children:`${i("Invoice Preview")} - #${e.invoice_number}`}),r.jsx("style",{children:`
                    body {
                        background-color: #f3f4f6;
                    }
                    @media print {
                        body {
                            background-color: #ffffff;
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .print-area {
                            box-shadow: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            width: 100% !important;
                        }
                    }
                `})]}),r.jsx("div",{className:"min-h-screen py-10 px-4 flex justify-center bg-gray-100",children:r.jsx("div",{ref:n,className:"print-area w-full max-w-[900px] bg-white p-10 shadow-lg rounded-xl border border-gray-200 transition-all duration-200",children:w()})})]})}export{oo as default};
