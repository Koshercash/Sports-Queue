import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MainScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return (
		<div>
			<Tabs defaultValue="home">
				<TabsList className="grid w-full grid-cols-5 mb-4">
					<TabsTrigger value="home">Home</TabsTrigger>
					<TabsTrigger value="profile">Profile</TabsTrigger>
					<TabsTrigger value="recent">Recent Games</TabsTrigger>
					<TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
					<TabsTrigger value="friends">Friends</TabsTrigger>
				</TabsList>
				{children}
			</Tabs>
		</div>
	);
};

export default MainScreen;