// Utility to get items unique to either array.
Array.prototype.diff = function(a) {
	return this.filter(function(i) {return a.indexOf(i) < 0;});
};

// This code will be run before saving a new bid.
Parse.Cloud.beforeSave("NewBid", function(request, response) {

	currentBid = request.object;

	// Grab the item that is being bid on.
	itemQuery = new Parse.Query("Item");
	itemQuery.equalTo("objectId", request.object.get("item"));
	itemQuery.first({
		success: function(item) {

			if (!item)
			 return;

			var date = Date.now();

			// Make sure bidding on this item hasn't closed.
			if (date > item.get("closetime")) {
				response.error("Bidding for this item has ended.");
				return;
			}

			// Make sure the bid isn't below the starting price.
			if (currentBid.get("amt") < item.get("price")) {
				response.error("Your bid needs to be higher than the item's starting price.");
				return;
			}

			// Make sure the bid increments by at least the minimum increment
            minIncrement = item.get("priceIncrement");
            if (!minIncrement) {
                minIncrement = 1;
            }
			if (currentBid.get("amt") < (item.get("currentPrice") + minIncrement )) {
				response.error("You need to raise the current price by at least $" + minIncrement);
				return;
			}

			// Sanity check. In-house testing revealed that people love bidding one trillion dollars.
			if (currentBid.get("amt") > 99999) {
				response.error("Remind me to apply for your job.");
				return;
			}

			// Retrieve all previous bids on this item.
			query = new Parse.Query("NewBid");
			query.equalTo("item", request.object.get("item"));
			query.descending("amt", "createdAt");
			query.limit = 1000; // Default is 100
			query.find({
			  success: function(allWinningBids) {

			  	item.set("numberOfBids", allWinningBids.length + 1);

			    var quantity = item.get("qty");
			    var currentPrice = [];
			    var currentWinners = [];
				var previousWinners = item.get("currentWinners");

   			    var allBidders = item.get("allBidders");
   			    if (!allBidders) {
   			    	allBidders = [];
   			    }

			    // Build an object mapping email addresses to their highest bids.
   			    var bidsForEmails = {};
   			    allWinningBids.forEach(function(bid) {
			   		var curBid = bidsForEmails[bid.get("email")]
			   		if (curBid) {
		   				bidsForEmails[bid.get("email")] = (curBid.get("amt") > bid.get("amt") ? curBid : bid);
			   		}
			   		else {
			   			bidsForEmails[bid.get("email")] = bid;
			   		}
   			    });

				// Get this bidder's last bid and make sure the new bid is an increase.
			  	// If the new bid is higher, remove the old bid.
   			    var previousMaxBid = bidsForEmails[currentBid.get("email")];
   			    if (previousMaxBid) {
   			    	if (currentBid.get("amt") <= previousMaxBid.get("amt")){
			    		response.error("You already bid $" + previousMaxBid.get("amt") + " - you need to raise your bid!");
		    			return;
   			    	}
					else {
   			    		delete bidsForEmails[currentBid.get("email")];
   			    	}
   			    }

				// Build an array of all the winning bids.
   			    allWinningBids = [];
   			    for (var key in bidsForEmails) {
   			    	allWinningBids.push(bidsForEmails[key]);
   			    }

			  	// Add the new bid and sort by amount, secondarily sorting by time.
   			    allWinningBids.push(currentBid)
   			    allWinningBids = allWinningBids.sort(function(a, b){
    					var keyA = a.get("amt");
    					var keyB = b.get("amt");

					    // Sort on amount if they're different.
					    if (keyA < keyB) {
					    	return 1;
					    }
					    else if (keyA > keyB) {
					     	return -1;
					 	}

    					var dateKeyA = a.get("createdAt");
    					var dateKeyB = b.get("createdAt");

						// Secondarily sort on time if the amounts are the same.
					    if (dateKeyA < dateKeyB) {
					    	return 1;
					    }
					    else if (dateKeyA > dateKeyB) {
					     	return -1;
					 	}

					    return 0;
					});

				// Slice off either the top n bids (for an item where the highest n bids win)
			  	// or all of them if there are fewer than n bids.
   			    var endIndex = 0;
   			    if (quantity > allWinningBids.length) {
   			    	endIndex = allWinningBids.length;
   			    }
				else {
   			    	endIndex = quantity;
   			    }

				var newBidIsWinning = false;
		    	var currentWinningBids = allWinningBids.slice(0, endIndex);

		    	// If the new bid is in the list of winning bids...
		    	if (currentWinningBids.indexOf(currentBid) != -1){
		    		newBidIsWinning = true;

					// Update the item's current price and current winners.
					for (var i = 0; (i < currentWinningBids.length); i++) {
						var bid = currentWinningBids[i];
						currentPrice.push(bid.get("amt"));
						currentWinners.push(bid.get("email"));
					}

			    	// Add this bidder to the list of all bidders...
			    	allBidders.push(currentBid.get("email"));

					// ...and remove them if they're already there.
			    	var uniqueArray = allBidders.filter(function(elem, pos) {
						return allBidders.indexOf(elem) == pos;
					});

				    item.set("allBidders", uniqueArray);
					item.set("currentPrice", currentPrice);
					item.set("currentWinners", currentWinners);
					item.set("previousWinners", previousWinners)

					// Save all these updates back to the Item.
					item.save(null, {
						success: function(item) {
							response.success();
						},
						error: function(item, error) {
							console.error(error);
							response.error("Something went wrong - try again?");
						}
					});
		    	}
				// If it's not, someone else probably outbid you in the meantime.
		    	else {
			    	response.error("Looks like you've been outbid! Check the new price and try again.");
		    		return;
		    	}


			  },
			  error: function(error) {
			    console.error("Error: " + error.code + " " + error.message);
			    response.error("Error: " + error.code + " " + error.message);
			  }
			});

		},
		error: function(error) {
		    console.error("Error: " + error.code + " " + error.message);
		    response.error("Error: " + error.code + " " + error.message);
		}
	});
	
});

// This code is run after the successful save of a new bid.
Parse.Cloud.afterSave("NewBid", function(request, response) {

	currentBid = request.object;

	// Get the item that's being bid on.
	itemQuery = new Parse.Query("Item");
	itemQuery.equalTo("objectId", request.object.get("item"))
	itemQuery.first({
		success: function(item) {

			var previousWinners = item.get("previousWinners");

			// For multi-quantity items, don't bother the people "higher" than you
			// ex: don't send a push to the person with the #1 bid if someone overtakes
			// the #2 person.
			var index = previousWinners.indexOf(currentBid.get("email"));
			if (index > -1) {
				previousWinners.splice(index, 1);
			}	

			// Grab installations where that user was previously a winner but no longer is.
			var query = new Parse.Query(Parse.Installation);
			query.containedIn("email", previousWinners.diff(item.get("currentWinners")));

			// We'll refer to the bidder by their name if it's set...
			var identity = currentBid.get("name").split("@")[0];

			// ...and their email prefix (ex. jtsuji@hubspot.com -> jtsuji) if it's not.
			if (identity.length < 3) {
				identity = currentBid.get("email").split("@")[0];
			}

			// Fire the push.
			Parse.Push.send({
			  where: query,
			  data: {
			    alert: identity + " bid $" + currentBid.get("amt") + " on " + item.get("name") + ". Surely you won't stand for this.", // People like sassy apps.
			    itemname: item.get("name"),
			    personname: identity,
			    itemid: item.id,
			    sound: "default",
			    amt: currentBid.get("amt"),
			    email: currentBid.get("email")
			  }
			}, {
			  success: function() {
			    console.log("Pushed successfully.")
			  },
			  error: function(error) {
			    console.error("Push failed: " +error)
			  }
			});

		}, 
		error: function(error) {
		    console.error("Push failed: " +error)
		}
	});

});

// Sets up all the tables for you.
Parse.Cloud.job("InitializeForAuction", function(request, status) {
	Parse.Cloud.useMasterKey();

	// Add a test item.
	var Item = Parse.Object.extend("Item"); 
	var item = new Item();  
	item.set("name", "Test Object 7");
	item.set("description", "This is a test object, and you (probably) won't be asked to donate your bid on this item to charity. Who knows, though.");
	item.set("donorname", "Generous Donor");
	item.set("price", 50);
    item.set("priceIncrement", 1);
	item.set("imageurl", "http://i.imgur.com/kCtWFwr.png");
	item.set("qty", "3");
	item.set("currentPrice", []);
	item.set("numberOfBids", 0);
	item.set("allBidders", []);
	item.set("currentWinners", []);
	item.set("previousWinners", [])
	item.set("opentime", new Date("Dec 05, 2014, 05:00"));
	item.set("closetime", new Date("Dec 06, 2015, 05:00"));
	item.save(null, {
		success: function(item) {
			var NewBid = Parse.Object.extend("NewBid"); 
			var bid = new NewBid();  
			bid.set("item", "");
			bid.set("amt", 0);
			bid.set("email", "");
			bid.set("name", "");
			bid.save(null, {
				success: function(bid) {
					console.log("Initialization complete.");
				},
				error: function(bid) {
					console.log("Initialization complete.");
				}
			});
		},
		error: function(item, error) {
			console.error("Unable to initialize Item table. Have you set your application name, app ID, and master key in config/global.json?")
		}
	});


});
