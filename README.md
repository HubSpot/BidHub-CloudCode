# FlappyBid: Cloud Code Backend
Backend code for HubSpot's open-source silent auction app. For an overview of the auction app project, [check out our blog post about it](http://dev.hubspot.com/coming-soon)!

The iOS and Android auction apps are backed by [Parse](https://parse.com/), a popular and free backend-as-a-service. Parse handles the database, and also allows you to add server-side logic that occurs when an action is taken (such as a client posting a new bid). This repository contains all of that server-side logic, as well as this helpful README that'll get you set up with Parse.

## Getting Started

1. [Sign up for Parse](https://www.parse.com/home/index#signup). 
2. `git clone` this repository and edit *config/global.json* to include your app's name, application ID, and master key (you can find these in Parse by going to Settings > Keys). 
3. [Install the Parse Command Line Tool](https://parse.com/docs/cloud_code_guide).
4. From the AuctionAppCloudCode directory, run `parse deploy`.

## Initializing the Database
The `parse deploy` command pushed *cloud/main.js* to Parse. You can see it in Parse by going to Core > Cloud Code. The first two functions contain all of the logic that runs before and after a NewBid is saved, and are run automatically by Parse. The third, *InitializeForAuction*, is a manual job that will set up your Item and NewBid tables with the correct columns. 

To run the job, go to Core > Jobs and click Schedule a Job. Use the settings shown below:
![Schedule a Job](http://i.imgur.com/Aho6eQK.png)

Scheduling the job should result in the screen below. Click Run Now to run the job. That's it! 

![Run Now](http://i.imgur.com/zxtMHTe.png)

Now, if you go to Data (on the left), you should see the Item and NewBid tables. Item will be populated with a Test Object, and both will have a number of auction-related columns.

<img src="http://i.imgur.com/2qFxj7j.png" alt="Drawing" style="width: 150px;"/>

## Adding Items
The easiest way to add an item is directly from Parse. Go to Core > Data > Item and add either a single item via the +Row button or many items via a CSV import.

## Data Models
That's it! You're all set up, and you can go play with the iOS and Android apps now. If you're interested in the data models, read on for a short description.

### Item

Represents a thing or service for sale. 

 * `allBidders` email addresses of everyone who has bid on this item
 * `closetime` after this time, bidding is closed
 * `currentPrice` current highest bid on this item (if qty > 1 and qty == n, highest n bids)
 * `currentWinners` email address of the current winner of this item (or n winners if qty > 1)
 * `description` long-form description of this item
 * `donorname` name of donor
 * `name` short(ish) name for this item
 * `numberOfBids` total number of bids for this item
 * `opentime` before this time, bidding is closed
 * `previousWinners` email address(es) of who was winning this item before the latest bid. Used by the server-side logic to send pushes only to people who are no longer winning an item.
 * `price` bids start at or above this price
 * `qty` how many of this item is available. For example, if 3 are available, the highest 3 bidders win.

### NewBid
Represents a single bid on an item. 

 * `amt` total dollar amount of bid
 * `email` Bidder's email (unique ID)
 * `item` objectId of item this bid is for
 * `name` Bidder's name
