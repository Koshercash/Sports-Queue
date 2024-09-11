import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../utils/mongodb';
import { authMiddleware } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

    const { db } = await connectToDatabase();

    const friendships = await db.collection('friends').find({
      user: new ObjectId(userId)
    }).toArray();

    console.log('Friendships:', friendships);

    const friendIds = friendships.map(f => new ObjectId(f.friend));

    const friends = await db.collection('users').find({
      _id: { $in: friendIds }
    }).toArray();

    console.log('Raw friends from database:', friends);

    const formattedFriends = friends.map(friend => {
      console.log('Formatting friend:', friend);
      return {
        id: friend._id.toString(),
        name: friend.name,
        profilePicture: friend.profilePicture || null
      };
    });

    console.log('Formatted friends:', formattedFriends);

    res.status(200).json(formattedFriends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}