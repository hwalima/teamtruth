import{r as c,j as r}from"./ui-KsqjVDMd.js";import{u as _,K as b,_ as h,a as k}from"./app-MHynqLjK.js";import{NewYork as v}from"./NewYork-_WLPKniq.js";import{Toronto as g}from"./Toronto-BYASw_dU.js";import{Rio as T}from"./Rio-rZ-NHugl.js";import{London as P}from"./London-bCobJiSG.js";import{Istanbul as A}from"./Istanbul-D51gB3rs.js";import{Mumbai as D}from"./Mumbai-D3SRaMjB.js";import{HongKong as I}from"./HongKong-BeRepw5p.js";import{Tokyo as L}from"./Tokyo-BvL9Ed7w.js";import{Sydney as R}from"./Sydney-Cnr__ufN.js";import{Paris as C}from"./Paris-DC1yyDCH.js";import{u as E}from"./usePdfDownload-Dysvnk-y.js";import{f as N}from"./currency-kzm_C5pv.js";import"./vendor-B1hewrmX.js";import"./utils-DBYZG17H.js";import"./QRCodeGenerator-BJrkCtjk.js";import"./html2canvas.esm-CBrSDip1.js";import"./jspdf.es.min-BRreQLYx.js";function oo(){const{t:i}=_(),{invoice:e,invoiceSettings:o}=b().props,{logoDark:m}=h(),n=c.useRef(null),{downloadPDF:l}=E(),p=(o==null?void 0:o.invoice_qr_display)==="true"||(o==null?void 0:o.invoice_qr_display)===!0,u=(o==null?void 0:o.invoice_footer_title)||"",d=(o==null?void 0:o.invoice_footer_notes)||"",a=(o==null?void 0:o.invoice_template)||"london",f=(o==null?void 0:o.invoice_color)||"#3b82f6",x=o!=null&&o.invoice_logo&&o.invoice_logo.trim()!==""?o.invoice_logo:m,y=s=>N(s);c.useEffect(()=>{const s=setTimeout(()=>{j()},1500);return()=>clearTimeout(s)},[]);const j=async()=>{n.current&&(await l(n.current,`Invoice-${e.invoice_number}.pdf`),window.close())},t={invoice:e,color:f,showQr:p,invoiceUrl:route("invoices.payment",e.payment_token),footerTitle:u,footerNotes:d,remainingAmount:e.balance_due,formatAmount:y,t:i,companyLogo:x},w=()=>{switch(a==null?void 0:a.toLowerCase()){case"new_york":return r.jsx(v,{...t});case"toronto":return r.jsx(g,{...t});case"rio":return r.jsx(T,{...t});case"istanbul":return r.jsx(A,{...t});case"mumbai":return r.jsx(D,{...t});case"hong_kong":return r.jsx(I,{...t});case"tokyo":return r.jsx(L,{...t});case"sydney":return r.jsx(R,{...t});case"paris":return r.jsx(C,{...t});case"london":default:return r.jsx(P,{...t})}};return r.jsxs(r.Fragment,{children:[r.jsxs(k,{children:[r.jsx("title",{children:`${i("Invoice Preview")} - #${e.invoice_number}`}),r.jsx("style",{children:`
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
