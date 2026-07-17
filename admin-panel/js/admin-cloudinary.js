/* ============================
   Cloudinary image upload (unsigned)
   ============================
   Fill these two values in from your Cloudinary dashboard:
   - Cloud Name: shown top-right of the Cloudinary console.
   - Upload Preset: Settings → Upload → Upload presets → Add upload preset
     → set "Signing Mode" to "Unsigned" → save → copy its name here.

   Why unsigned uploads: they let the browser upload straight to Cloudinary
   without your backend ever touching the image bytes or needing an API
   secret client-side. The resulting secure_url is just a normal string
   the admin panel saves onto the product like any other field — your
   backend doesn't need to know Cloudinary exists at all.
*/
const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";       // ← replace me
const CLOUDINARY_UPLOAD_PRESET = "YOUR_UPLOAD_PRESET"; // ← replace me

async function uploadImageToCloudinary(file) {
  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    throw new Error('Cloudinary is not configured yet — set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in js/admin-cloudinary.js');
  }

  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    let msg = 'Image upload failed — please try again.';
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) msg = errBody.error.message;
    } catch (_) { /* not JSON */ }
    throw new Error(msg);
  }

  const data = await res.json();
  return data.secure_url;
}
