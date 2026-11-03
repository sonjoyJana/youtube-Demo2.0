import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

const { cloudName, apiKey, apiSecret } = env.cloudinary;

if (cloudName) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey || undefined,
    api_secret: apiSecret || undefined,
    secure: true
  });
}

export function isCloudinaryConfigured() {
  return Boolean(env.cloudinary.cloudName);
}

export function cloudinaryVideoUrl(publicId, { download = false, transformation = '' } = {}) {
  if (!isCloudinaryConfigured() || !publicId) return '';
  return cloudinary.url(publicId, {
    resource_type: 'video',
    type: 'upload',
    secure: true,
    transformation: transformation || undefined,
    flags: download ? 'attachment' : undefined
  });
}

export function cloudinaryPosterUrl(publicId) {
  if (!isCloudinaryConfigured() || !publicId) return '';
  return cloudinary.url(publicId, {
    resource_type: 'video',
    type: 'upload',
    secure: true,
    format: 'jpg'
  });
}

export { cloudinary };
