import mongoose from 'mongoose';

let connecting = null;

export async function connectDatabase() {
  if (connecting) return connecting;
  connecting = mongoose
    .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamtube', {
      serverSelectionTimeoutMS: 10000,
      autoIndex: true
    })
    .then(() => mongoose.connection);
  return connecting;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 1) return;
  await mongoose.disconnect();
  connecting = null;
}

export async function syncIndexes() {
  await mongoose.connection.db.syncIndexes();
}
