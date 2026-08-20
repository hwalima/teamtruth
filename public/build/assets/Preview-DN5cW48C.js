import{r as c,j as r}from"./ui-Bmy0jaVP.js";import{u as _,K as b,q as h,L as k}from"./app-DbJ_MkE9.js";import{NewYork as v}from"./NewYork-CcVlGhva.js";import{Toronto as g}from"./Toronto-dJyLPzSf.js";import{Rio as T}from"./Rio-CK55cgVs.js";import{London as P}from"./London-CnmlLX5O.js";import{Istanbul as L}from"./Istanbul-Bbp5IOo-.js";import{Mumbai as A}from"./Mumbai-Bv7PR5te.js";import{HongKong as D}from"./HongKong-_FMEJmpV.js";import{Tokyo as I}from"./Tokyo-SK_98nxj.js";import{Sydney as R}from"./Sydney-C73gxnNU.js";import{Paris as q}from"./Paris-CPI83Sh8.js";import{u as C}from"./usePdfDownload-DRLzAnr9.js";import{f as E}from"./currency-kzm_C5pv.js";import"./vendor-B1hewrmX.js";import"./utils-DBYZG17H.js";import"./QRCodeGenerator-Dh4AlFjO.js";function Z(){const{t:i}=_(),{invoice:t,invoiceSettings:o}=b().props,{logoDark:m}=h(),n=c.useRef(null),{downloadPDF:l}=C(),p=(o==null?void 0:o.invoice_qr_display)==="true"||(o==null?void 0:o.invoice_qr_display)===!0,u=(o==null?void 0:o.invoice_footer_title)||"",d=(o==null?void 0:o.invoice_footer_notes)||"",a=(o==null?void 0:o.invoice_template)||"london",f=(o==null?void 0:o.invoice_color)||"#3b82f6",x=o!=null&&o.invoice_logo&&o.invoice_logo.trim()!==""?o.invoice_logo:m,y=s=>E(s);c.useEffect(()=>{const s=setTimeout(()=>{j()},1500);return()=>clearTimeout(s)},[]);const j=async()=>{n.current&&(await l(n.current,`Invoice-${t.invoice_number}.pdf`),window.close())},e={invoice:t,color:f,showQr:p,invoiceUrl:route("invoices.payment",t.payment_token),footerTitle:u,footerNotes:d,remainingAmount:t.balance_due,formatAmount:y,t:i,companyLogo:x},w=()=>{switch(a==null?void 0:a.toLowerCase()){case"new_york":return r.jsx(v,{...e});case"toronto":return r.jsx(g,{...e});case"rio":return r.jsx(T,{...e});case"istanbul":return r.jsx(L,{...e});case"mumbai":return r.jsx(A,{...e});case"hong_kong":return r.jsx(D,{...e});case"tokyo":return r.jsx(I,{...e});case"sydney":return r.jsx(R,{...e});case"paris":return r.jsx(q,{...e});case"london":default:return r.jsx(P,{...e})}};return r.jsxs(r.Fragment,{children:[r.jsxs(k,{children:[r.jsx("title",{children:`${i("Invoice Preview")} - #${t.invoice_number}`}),r.jsx("style",{children:`
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
                `})]}),r.jsx("div",{className:"min-h-screen py-10 px-4 flex justify-center bg-gray-100",children:r.jsx("div",{ref:n,className:"print-area w-full max-w-[900px] bg-white p-10 shadow-lg rounded-xl border border-gray-200 transition-all duration-200",children:w()})})]})}export{Z as default};
