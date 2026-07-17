const CLOUDINARY_CLOUD_NAME = "do6v2ghbb";
const CLOUDINARY_UPLOAD_PRESET = "lawnmovers";

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
