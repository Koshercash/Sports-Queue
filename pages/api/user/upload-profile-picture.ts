import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../../utils/mongodb';
import { authMiddleware } from '../../../utils/auth';
import { ObjectId } from 'mongodb';
import * as path from 'path';
import { promises as fs } from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      authMiddleware(req, res, (result: unknown) => {
        if (result instanceof Error) {
          return reject(result);
        }
        resolve();
      });
    });

    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      const form = new (require('formidable').IncomingForm)();
      form.uploadDir = path.join(process.cwd(), 'public', 'uploads');
      form.keepExtensions = true;
      form.parse(req, (err: any, fields: any, files: any) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    if (!files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = files.file;
    const fileName = path.basename(file.filepath);

    console.log('File saved:', file.filepath);

    const { db } = await connectToDatabase();
    const updateResult = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { profilePicture: `/uploads/${fileName}` } }
    );

    console.log('Update result:', updateResult);

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ error: 'Failed to update profile picture in database' });
    }

    // Add this log to check the updated user document
    const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    console.log('Updated user document:', updatedUser);

    res.status(200).json({ message: 'Profile picture updated successfully', fileName });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}