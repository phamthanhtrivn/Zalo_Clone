import { FriendStatus } from 'src/common/types/enums/friend-status';
import { User } from '../schemas/user.schema';
import { Model } from 'mongoose';

export async function updateFriendStatus(
  userModel: Model<User>,
  userId: string,
  friendId: string,
  newStatus: FriendStatus,
) {
  const updated = await userModel.findOneAndUpdate(
    {
      _id: userId,
      'friends.friendId': friendId,
    },
    {
      $set: {
        'friends.$.status': newStatus,
      },
    },
    { new: true },
  );

  if (!updated) {
    return await userModel.findByIdAndUpdate(
      userId,
      {
        $push: {
          friends: {
            friendId: friendId,
            status: newStatus,
          },
        },
      },
      { new: true },
    );
  }

  return updated;
}
