export interface User {
    id: string;
    _id?: string;
    username: string;
    email: string;
    profilePicture?: string;
    bio?: string;
    college?: string;
    followersCount?: number;
    followingCount?: number;
    isFollowing?: boolean;
}

export interface Post {
    id: string;
    _id: string;
    user: User;
    caption: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    timestamp: string;
    likes: number;
    liked: boolean;
    comments: number;
    poll?: Poll;
}

export interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    duration: number;
    durationUnit: 'minutes' | 'hours' | 'days';
    allowVoteChange: boolean;
    expiresAt: string;
    totalVotes: number;
    hasVoted: boolean;
    userVote?: number;
}

export interface PollOption {
    id: string;
    text: string;
    votes: number;
}

export interface Comment {
    id: string;
    user: User;
    text: string;
    timestamp: string;
    likes: number;
    replies?: Comment[];
}

export interface Notification {
    id: string;
    type: 'like' | 'comment' | 'follow' | 'mention' | 'share' | 'reply';
    actor: User;
    targetId: string; // post id, comment id, etc.
    isRead: boolean;
    timestamp: string;
    message?: string;
}

export interface Collection {
    _id: string;
    name: string;
    description?: string;
    color: string;
    isPublic: boolean;
    posts: string[] | Post[];
    createdAt: string;
    updatedAt: string;
}

export interface TimeSlot {
    _id: string;
    start: string;
    end: string;
    isBooked: boolean;
}

export interface Availability {
    _id: string;
    day: string;
    slots: TimeSlot[];
}

export interface MentorProfile {
    _id: string;
    userId: User;
    bio: string;
    skills: string[];
    major: string;
    yearOfGraduation: number;
    availability: Availability[];
    pricing: {
        isFree: boolean;
        amount: number;
        currency: string;
    };
    rating: {
        average: number;
        count: number;
    };
    matchScore?: number;
}
