import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../utils/mongodb';
import { authMiddleware } from '../../../utils/auth';

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
    const { friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ error: 'Invalid user ID or friend ID' });
    }

    const { db } = await connectToDatabase();

    // Check if friendship already exists
    const existingFriendship = await db.collection('friends').findOne({
      user: new ObjectId(userId),
      friend: new ObjectId(friendId)
    });

    if (existingFriendship) {
      return res.status(400).json({ error: 'Friendship already exists' });
    }

    // Add new friendship
    await db.collection('friends').insertOne({
      user: new ObjectId(userId),
      friend: new ObjectId(friendId)
    });

    res.status(200).json({ message: 'Friend added successfully' });
  } catch (error) {
    console.error('Error adding friend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}