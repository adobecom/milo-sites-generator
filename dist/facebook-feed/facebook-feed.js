/* empty css                      */import{g as p}from"../chunks/aem-HYeY23SW.js";const d="facebookapi",h="/src/blocks/facebook-feed/fbApi.json",f={headers:{Authorization:"Bearer ZmFjZWJvb2stc3dzLWF1dGhvcml6ZXItc3dzLWNsb3VkOktlbm5ldGhTV1M=","Content-Type":"application/json"}};async function u(){const e=window.location.hostname==="localhost";try{const t=await p();return e&&(!t||!t[d])?h:t[d]}catch(t){console.error("Error fetching placeholders:",t);return}}async function w(e){return new Promise(t=>{t(null),(async()=>{const o=await u();if(o)try{const n=await fetch(o,{method:"GET",...f});if(!n.ok)throw new Error(`Facebook API request failed: ${n.statusText}`);const s=await n.json();if(!s||!s.length||!s[0].posts)throw new Error("No Facebook posts found");const i=JSON.parse(s[0].posts),r=[];for(let a=0;a<i.length;a+=1){const c=i[a];if(c.full_picture&&c.message&&m(c.full_picture)&&(r.push(c),r.length===3))break}v(r,e)}catch(n){console.error("Error fetching Facebook API:",n)}})()})}const l=document.createElement("template");l.innerHTML=`<div class="nsw-col nsw-col-md-6 nsw-col-lg-4">
      <div class="nsw-card nsw-card--highlight">
        <div class="nsw-card__image">
        <img alt="Facebook post image">
        </div>
        <div class="nsw-card__content">
          <div class="nsw-card__copy">
            <p>
              <a></a>
            </p>
          </div>
          <div class="card-icon">
            <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#1578f2" d="M32 16.098C32 7.207 24.837 0 16 0S0 7.207 0 16.098C0 24.133 5.851 30.793 13.5 32V20.751H9.437v-4.653H13.5v-3.547c0-4.035 2.389-6.263 6.043-6.263 1.751 0 3.582.314 3.582.314v3.962h-2.018c-1.988 0-2.607 1.241-2.607 2.514v3.02h4.438l-.709 4.653h-3.728V32c7.649-1.208 13.5-7.867 13.5-15.902z"/></svg>
          </div>
          <span class="material-icons nsw-material-icons" focusable="false" aria-hidden="true">east</span>
        </div>
      </div>
    </div>`;function m(e){try{const{protocol:t}=new URL(e);return t==="https:"||t==="http:"}catch{return!1}}function g(e){const t=l.content.firstElementChild.cloneNode(!0);t.querySelector("img").src=e.full_picture;const o=t.querySelector(".nsw-card__copy a");return o.href=`https://www.facebook.com/${encodeURIComponent(String(e.id))}`,o.textContent=e.message,t}function v(e,t){if(!e||!e.length||!t)return;const o=document.createElement("div");o.classList.add("nsw-grid"),o.append(...e.map(g)),t.textContent="",t.append(o)}async function _(e){const t=document.createElement("div");t.classList.add("nsw-grid"),t.innerHTML=`<div class="nsw-col nsw-col-md-12">
    <p>Loading Facebook posts...</p>
  </div>`,e.textContent="",e.append(t),await w(e)}export{_ as default};
//# sourceMappingURL=facebook-feed.js.map
