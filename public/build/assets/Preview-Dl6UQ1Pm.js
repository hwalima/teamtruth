import{r as c,j as r}from"./ui-KsqjVDMd.js";import{u as _,K as b,ae as h,l as k}from"./app-DHCFMtOw.js";import{NewYork as v}from"./NewYork-_WLPKniq.js";import{Toronto as g}from"./Toronto-BkXkRyag.js";import{Rio as T}from"./Rio-DdjuszKE.js";import{London as P}from"./London-DTsQ68WJ.js";import{Istanbul as A}from"./Istanbul-wSJJrwZJ.js";import{Mumbai as D}from"./Mumbai-CdJVMxmf.js";import{HongKong as I}from"./HongKong-C1nrtjaX.js";import{Tokyo as L}from"./Tokyo-CpRPuhiD.js";import{Sydney as R}from"./Sydney-B9RBxDZ1.js";import{Paris as C}from"./Paris-BE7Kxs6D.js";import{u as E}from"./usePdfDownload-6XNrRdyz.js";import{f as N}from"./currency-kzm_C5pv.js";import"./vendor-B1hewrmX.js";import"./utils-DBYZG17H.js";import"./QRCodeGenerator-BJrkCtjk.js";import"./html2canvas.esm-CBrSDip1.js";import"./jspdf.es.min-BH2tYiVo.js";function oo(){const{t:i}=_(),{invoice:t,invoiceSettings:o}=b().props,{logoDark:m}=h(),n=c.useRef(null),{downloadPDF:l}=E(),p=(o==null?void 0:o.invoice_qr_display)==="true"||(o==null?void 0:o.invoice_qr_display)===!0,u=(o==null?void 0:o.invoice_footer_title)||"",d=(o==null?void 0:o.invoice_footer_notes)||"",a=(o==null?void 0:o.invoice_template)||"london",f=(o==null?void 0:o.invoice_color)||"#3b82f6",x=o!=null&&o.invoice_logo&&o.invoice_logo.trim()!==""?o.invoice_logo:m,y=s=>N(s);c.useEffect(()=>{const s=setTimeout(()=>{j()},1500);return()=>clearTimeout(s)},[]);const j=async()=>{n.current&&(await l(n.current,`Invoice-${t.invoice_number}.pdf`),window.close())},e={invoice:t,color:f,showQr:p,invoiceUrl:route("invoices.payment",t.payment_token),footerTitle:u,footerNotes:d,remainingAmount:t.balance_due,formatAmount:y,t:i,companyLogo:x},w=()=>{switch(a==null?void 0:a.toLowerCase()){case"new_york":return r.jsx(v,{...e});case"toronto":return r.jsx(g,{...e});case"rio":return r.jsx(T,{...e});case"istanbul":return r.jsx(A,{...e});case"mumbai":return r.jsx(D,{...e});case"hong_kong":return r.jsx(I,{...e});case"tokyo":return r.jsx(L,{...e});case"sydney":return r.jsx(R,{...e});case"paris":return r.jsx(C,{...e});case"london":default:return r.jsx(P,{...e})}};return r.jsxs(r.Fragment,{children:[r.jsxs(k,{children:[r.jsx("title",{children:`${i("Invoice Preview")} - #${t.invoice_number}`}),r.jsx("style",{children:`
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
