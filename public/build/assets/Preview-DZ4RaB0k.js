import{r as c,j as r}from"./ui-Bmy0jaVP.js";import{u as _,K as b,q as h,L as k}from"./app-DZnwkPwv.js";import{NewYork as v}from"./NewYork-CcVlGhva.js";import{Toronto as g}from"./Toronto-CQ-z922-.js";import{Rio as T}from"./Rio-_QBTIlUQ.js";import{London as P}from"./London-CxFqKebF.js";import{Istanbul as L}from"./Istanbul-BcV-Mma5.js";import{Mumbai as A}from"./Mumbai-W5pjgY39.js";import{HongKong as D}from"./HongKong-Dmxmur1s.js";import{Tokyo as I}from"./Tokyo-B1c0-HFP.js";import{Sydney as R}from"./Sydney-DKvS-9C8.js";import{Paris as q}from"./Paris-Ctt4ksHz.js";import{u as C}from"./usePdfDownload-D5uXS3mL.js";import{f as E}from"./currency-kzm_C5pv.js";import"./vendor-B1hewrmX.js";import"./utils-DBYZG17H.js";import"./QRCodeGenerator-Dh4AlFjO.js";import"./html2canvas.esm-CBrSDip1.js";import"./jspdf.es.min-BFwHuDC1.js";function oo(){const{t:i}=_(),{invoice:e,invoiceSettings:o}=b().props,{logoDark:m}=h(),n=c.useRef(null),{downloadPDF:l}=C(),p=(o==null?void 0:o.invoice_qr_display)==="true"||(o==null?void 0:o.invoice_qr_display)===!0,u=(o==null?void 0:o.invoice_footer_title)||"",d=(o==null?void 0:o.invoice_footer_notes)||"",a=(o==null?void 0:o.invoice_template)||"london",f=(o==null?void 0:o.invoice_color)||"#3b82f6",x=o!=null&&o.invoice_logo&&o.invoice_logo.trim()!==""?o.invoice_logo:m,y=s=>E(s);c.useEffect(()=>{const s=setTimeout(()=>{j()},1500);return()=>clearTimeout(s)},[]);const j=async()=>{n.current&&(await l(n.current,`Invoice-${e.invoice_number}.pdf`),window.close())},t={invoice:e,color:f,showQr:p,invoiceUrl:route("invoices.payment",e.payment_token),footerTitle:u,footerNotes:d,remainingAmount:e.balance_due,formatAmount:y,t:i,companyLogo:x},w=()=>{switch(a==null?void 0:a.toLowerCase()){case"new_york":return r.jsx(v,{...t});case"toronto":return r.jsx(g,{...t});case"rio":return r.jsx(T,{...t});case"istanbul":return r.jsx(L,{...t});case"mumbai":return r.jsx(A,{...t});case"hong_kong":return r.jsx(D,{...t});case"tokyo":return r.jsx(I,{...t});case"sydney":return r.jsx(R,{...t});case"paris":return r.jsx(q,{...t});case"london":default:return r.jsx(P,{...t})}};return r.jsxs(r.Fragment,{children:[r.jsxs(k,{children:[r.jsx("title",{children:`${i("Invoice Preview")} - #${e.invoice_number}`}),r.jsx("style",{children:`
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
