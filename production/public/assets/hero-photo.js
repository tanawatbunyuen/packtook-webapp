"use strict";
/* PACKTOOK Marketing V6.5.4: load locally hosted AI Hero photo, fallback to SVG.
   Never request third-party resources. Does not access Firebase or user data. */
(()=>{
 const hero=document.getElementById("heroPackingImage");
 if(!hero)return;
 const asset=hero.getAttribute("data-photo-src");
 if(!asset||!asset.startsWith("/assets/")||!asset.endsWith(".webp"))return;
 const image=new Image();
 image.onload=()=>{
  // Retain accessible Thai alt and intrinsic photo dimensions.
  hero.src=asset;
  document.documentElement.classList.add("packtook-photo-ready");
 };
 image.onerror=()=>{ /* Keep existing bundled SVG illustration if photo absent. */ };
 image.src=asset;
})();
