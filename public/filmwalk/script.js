// Bonus location details data
const bonusLocationDetails = {
    11: {
        title: "Temple Church",
        description: "This 12th-century church was the headquarters of the Knights Templar and offers a perfect medieval setting for film productions.",
        films: [
            {
                title: "The Da Vinci Code (2006)",
                detail: "Tom Hanks searches among the effigies of crusader knights for clues to the Holy Grail mystery."
            }
        ],
        tips: "Entry fee required. Check opening times as they vary. The round church is particularly atmospheric."
    },
    12: {
        title: "Fleet Street",
        description: "Once the heart of British journalism, this historic street has appeared in many films requiring a Victorian London atmosphere.",
        films: [
            {
                title: "Children of Men (2006)",
                detail: "Clive Owen barely escapes a café explosion in the dramatic opening sequence."
            },
            {
                title: "Sweeney Todd (2007)",
                detail: "The demon barber's shop was recreated on this historic street."
            }
        ],
        tips: "Free to walk along. Many historic pubs and buildings to explore."
    },
    13: {
        title: "College of Arms",
        description: "The official repository of coats of arms and pedigrees since 1484, providing an authentic backdrop for spy films.",
        films: [
            {
                title: "On Her Majesty's Secret Service (1969)",
                detail: "George Lazenby's James Bond researches Blofeld's ancestry here. A chase scene was planned but cut for time."
            }
        ],
        tips: "External viewing only unless you have heraldic business. Beautiful historic building."
    },
    14: {
        title: "Liverpool Street Station",
        description: "One of London's busiest railway terminals, frequently used for dramatic arrivals and departures in films.",
        films: [
            {
                title: "Mission Impossible (1996)",
                detail: "Tom Cruise makes a tense phone call here before meeting Jon Voight."
            },
            {
                title: "The Bourne Ultimatum (2007)",
                detail: "Jason Bourne navigates through the crowds during a chase sequence."
            }
        ],
        tips: "Free to explore. Great Victorian architecture. Busy during rush hours."
    },
    15: {
        title: "The Gherkin (30 St Mary Axe)",
        description: "Norman Foster's iconic skyscraper has become a symbol of modern London in numerous films.",
        films: [
            {
                title: "Basic Instinct 2 (2006)",
                detail: "Featured prominently in establishing shots of London."
            },
            {
                title: "Thor: The Dark World (2013)",
                detail: "Visible during the climactic battle across London."
            }
        ],
        tips: "Sky Garden at the top requires advance booking but offers free panoramic views."
    },
    16: {
        title: "Lloyd's Building",
        description: "Richard Rogers' inside-out building is a favorite for sci-fi films needing a futuristic setting.",
        films: [
            {
                title: "Spy Game (2001)",
                detail: "Transformed into the US embassy in Hong Kong."
            },
            {
                title: "Entrapment (1999)",
                detail: "Digitally transported to Malaysia with added palm trees."
            }
        ],
        tips: "External viewing only. Best photographed from Leadenhall Market."
    },
    17: {
        title: "Minster Court",
        description: "This Gothic-revival office complex provides a dramatic backdrop for villain headquarters.",
        films: [
            {
                title: "101 Dalmatians (1996)",
                detail: "Served as Cruella de Vil's fashion house headquarters."
            }
        ],
        tips: "External viewing only. Impressive architecture especially when lit at night."
    },
    18: {
        title: "Mansion House",
        description: "The official residence of the Lord Mayor of London, featuring opulent interiors perfect for period films.",
        films: [
            {
                title: "The Golden Bowl (2000)",
                detail: "The Lord Mayor and Lady Mayoress appeared as extras in the sumptuous dance scene."
            }
        ],
        tips: "Tours available on select Saturdays. Check website for dates."
    },
    19: {
        title: "Guildhall",
        description: "London's ceremonial center since the 12th century, with a Great Hall that's hosted many film banquets.",
        films: [
            {
                title: "Bean 2",
                detail: "The entrance was used as a Parisian hotel."
            },
            {
                title: "RKO 281 (1999)",
                detail: "The story behind Citizen Kane featured a banquet in the Great Hall."
            }
        ],
        tips: "Free to visit the Great Hall. Check for events which may restrict access."
    },
    20: {
        title: "Broadgate Circle",
        description: "A modern public space surrounded by offices, often used for contemporary urban scenes.",
        films: [
            {
                title: "Spiceworld (1997)",
                detail: "The Spice Girls performed here in a scene set in Milan."
            }
        ],
        tips: "Free public space with restaurants and occasional events."
    },
    21: {
        title: "Citypoint",
        description: "A triangular skyscraper that provides a distinctive silhouette in London skyline shots.",
        films: [
            {
                title: "Scoop (2006)",
                detail: "Woody Allen and Scarlett Johansson spy on Hugh Jackman from here."
            },
            {
                title: "28 Weeks Later (2007)",
                detail: "Featured in post-apocalyptic London scenes."
            }
        ],
        tips: "External viewing only. Good views from Ropemaker Street."
    },
    22: {
        title: "Blackfriars Bridge",
        description: "A Victorian bridge with distinctive red and white paintwork, often featured in Thames sequences.",
        films: [
            {
                title: "The Imaginarium of Doctor Parnassus (2009)",
                detail: "Heath Ledger's character is found hanging beneath the bridge in his final film."
            },
            {
                title: "Love Actually (2003)",
                detail: "Featured in establishing shots of London."
            }
        ],
        tips: "Free to walk across. Great views of St Paul's and the City skyline."
    }
};

// Location details data
const locationDetails = {
    1: {
        title: "The Millennium Bridge",
        description: "Start at the Bankside (south) entrance. This pedestrian-only bridge opened in 2000 and quickly became a favorite for filmmakers. Its futuristic design makes it perfect for sci-fi films.",
        films: [
            {
                title: "Guardians of the Galaxy (2014)",
                detail: "The bridge appears as part of planet Xandar during the Battle of Xandar. Civilians on the bridge are saved by Rocket Raccoon."
            },
            {
                title: "James Bond: Spectre (2015)",
                detail: "Miss Moneypenny walks across the bridge with St Paul's Cathedral beautifully framed behind her."
            }
        ],
        tips: "Start at the Bankside entrance near Shakespeare's Globe. Best photographed in early morning light. Walk across for stunning views of St Paul's Cathedral."
    },
    2: {
        title: "St Paul's Cathedral",
        description: "Sir Christopher Wren's masterpiece has been a backdrop for countless films, from period dramas to modern action blockbusters.",
        films: [
            {
                title: "Mission Impossible: Fallout (2018)",
                detail: "Tom Cruise famously broke his ankle during the rooftop chase scene filmed here."
            },
            {
                title: "Thor: The Dark World (2013)",
                detail: "Thor dramatically falls from another dimension onto the cathedral steps during his battle with Malekith."
            },
            {
                title: "Lawrence of Arabia (1962)",
                detail: "David Lean filmed acquaintances of T.E. Lawrence offering opinions after his memorial service."
            },
            {
                title: "The Madness of King George (1994)",
                detail: "The Cathedral steps are the location for the triumphant finale of this historical drama."
            },
            {
                title: "Great Expectations (1946)",
                detail: "This is where Pip arrives in London in David Lean's adaptation of Dickens's classic."
            },
            {
                title: "Paddington 2 (2017)",
                detail: "The Brown family investigates a fallen statue inside the cathedral while trying to prove Paddington's innocence."
            }
        ],
        tips: "Entry fee required for the cathedral interior. The steps are free and offer great photo opportunities."
    },
    3: {
        title: "The Old Bailey",
        description: "London's Central Criminal Court, crowned by the famous Lady Justice statue, has been dramatically destroyed on film multiple times.",
        films: [
            {
                title: "Justice League (2017)",
                detail: "Wonder Woman stands atop the golden Justice statue before swooping down to stop a bank robbery."
            },
            {
                title: "V for Vendetta (2005)",
                detail: "V and Evey watch from the rooftops as V detonates explosives, destroying the Old Bailey in an iconic scene."
            }
        ],
        tips: "Public galleries are open Monday-Friday. Photography is not allowed inside the building."
    },
    4: {
        title: "Postman's Park",
        description: "This small park contains the Memorial to Heroic Self-Sacrifice, featuring ceramic tiles commemorating ordinary people who died saving others.",
        films: [
            {
                title: "Closer (2004)",
                detail: "Jude Law and Natalie Portman's characters meet here and admire the memorial tiles, beginning their romance."
            },
            {
                title: "Tomb Raider (2018)",
                detail: "Alicia Vikander cycles through the park during a fox hunt race before crashing into a police car."
            }
        ],
        tips: "A peaceful spot for a break. The memorial wall is genuinely moving and worth reading."
    },
    5: {
        title: "Smithfield Market",
        description: "London's historic meat market, operating since medieval times, provides an atmospheric backdrop for spy thrillers.",
        films: [
            {
                title: "Skyfall (2012)",
                detail: "The new MI6 headquarters are accessed through a gated entrance opposite the market."
            },
            {
                title: "I May Destroy You (2020)",
                detail: "The dramatic series finale takes place here as Arabella confronts her attacker."
            }
        ],
        tips: "Visit early morning (before 7am) to see the market in full swing. Great Victorian architecture."
    },
    6: {
        title: "St Bartholomew the Great",
        description: "London's oldest surviving church, founded in 1123, provides an authentic medieval setting for historical films.",
        films: [
            {
                title: "Four Weddings and a Funeral (1994)",
                detail: "Hugh Grant's character leaves his bride at the altar here, resulting in a memorable punch to the face."
            },
            {
                title: "Sherlock Holmes (2009)",
                detail: "Holmes and Watson interrupt Lord Blackwood's sinister human sacrifice ritual."
            },
            {
                title: "Shakespeare in Love (1998)",
                detail: "Featured as a key location in this Oscar-winning romantic drama."
            }
        ],
        tips: "Small entry fee. The atmospheric interior is worth visiting even without the film connections."
    },
    7: {
        title: "Barbican Centre",
        description: "This brutalist architectural complex is Europe's largest performing arts center and a favorite location for spy films and music videos.",
        films: [
            {
                title: "Quantum of Solace (2008)",
                detail: "The distinctive concrete walkways serve as MI6 headquarters where M briefs Bond."
            },
            {
                title: "Luther (2010)",
                detail: "The residential towers feature prominently, including Alice's apartment scenes."
            },
            {
                title: "Skepta - Shutdown (2015)",
                detail: "This iconic grime music video showcased the Barbican estate to over 50 million viewers."
            }
        ],
        tips: "Free to explore the public areas. The conservatory is a hidden tropical oasis (check opening times)."
    },
    8: {
        title: "Cornhill & Royal Exchange",
        description: "The historic financial heart of London has hosted everything from romantic snow scenes to explosive action sequences.",
        films: [
            {
                title: "Bridget Jones's Diary (2001)",
                detail: "The famous scene where Bridget runs after Mark Darcy in her underwear through fake snow, filmed over two nights in April."
            },
            {
                title: "28 Days Later (2002)",
                detail: "Bank Junction was completely deserted for Danny Boyle's zombie apocalypse masterpiece."
            },
            {
                title: "National Treasure: Book of Secrets (2007)",
                detail: "High-speed vehicle chase with cars smashing into each other around Bank Junction."
            },
            {
                title: "London Has Fallen (2016)",
                detail: "An intense car chase and shootout takes place through these streets."
            },
            {
                title: "The Mummy Returns (2001)",
                detail: "A double-decker bus chase fighting off mummies races through Cornhill."
            },
            {
                title: "Ocean's 13 (2007)",
                detail: "Matt Damon can be seen at the junction with London Wall talking on the phone to the gang."
            }
        ],
        tips: "The Royal Exchange now houses shops and restaurants. Great architecture for photos. Bank Junction offers impressive views of multiple historic buildings."
    },
    9: {
        title: "Leadenhall Market",
        description: "This beautiful Victorian market has been an ever-popular filming location, serving as everything from magical alleys to Vietnamese cafés.",
        films: [
            {
                title: "Harry Potter and the Philosopher's Stone (2001)",
                detail: "The Leaky Cauldron entrance was at Bull's Head Passage (now marked with a blue door), leading to Diagon Alley."
            },
            {
                title: "Tomb Raider (2001)",
                detail: "Lara Croft (Angelina Jolie) speeds through the market on her motorbike."
            },
            {
                title: "Proof of Life (2000)",
                detail: "Pizza Express was transformed into the 'Saigon Times' where Russell Crowe's character gets a new assignment."
            },
            {
                title: "Hereafter (2010)",
                detail: "Clint Eastwood directed scenes here, including Matt Damon's romantic café reunion."
            },
            {
                title: "The Imaginarium of Doctor Parnassus (2009)",
                detail: "The market's Victorian architecture provided the perfect backdrop for Terry Gilliam's fantasy."
            },
            {
                title: "Tinker Tailor Soldier Spy (2011)",
                detail: "Featured as part of Cold War-era London in this spy thriller."
            }
        ],
        tips: "Visit on weekdays when the market is bustling. The blue door at 42 Bull's Head Passage marks the Leaky Cauldron entrance. Many restaurants and shops to explore."
    },
    10: {
        title: "Tower Bridge",
        description: "London's most iconic bridge has been destroyed, invaded, leapt across, and used as a superhero battleground countless times on screen.",
        films: [
            {
                title: "Spider-Man: Far From Home (2019)",
                detail: "The epic final battle between Spider-Man and Mysterio takes place on and around the bridge."
            },
            {
                title: "Brannigan (1975)",
                detail: "John Wayne's character makes an infamous unplanned leap across the half-opened bridge."
            },
            {
                title: "The Mummy Returns (2001)",
                detail: "John Hannah drives a double-decker bus over the bridge while fighting off the undead."
            },
            {
                title: "Bridget Jones's Diary (2001)",
                detail: "Bridget walks across during rush hour in one of the film's London montages."
            },
            {
                title: "Tomb Raider (2001)",
                detail: "Lara Croft races across on her motorbike during an action sequence."
            },
            {
                title: "Sherlock Holmes (2009)",
                detail: "Digitally recreated for the gripping finale fight between Holmes and Lord Blackwood."
            },
            {
                title: "Thor: The Dark World (2013)",
                detail: "Thor's hammer flies through a portal and appears at Tower Bridge during the climactic battle."
            },
            {
                title: "Thunderbirds (2004)",
                detail: "Thunderbird 2 flies through the open bridge in this live-action adaptation."
            }
        ],
        tips: "The Tower Bridge Exhibition offers glass floor walkways and great views. Best photographed from the South Bank. The bridge lifts over 900 times a year for tall ships."
    }
};

// Show full route on map
function showFullRoute() {
    // Fit the map to show the entire route
    if (map && routeLayer) {
        map.fitBounds(routeLayer.getBounds().pad(0.1));
    }
}

async function getDirections() {
    // Toggle directions panel
    const panel = document.getElementById('directionsPanel');
    panel.classList.toggle('show');
    
    // Scroll to panel if showing
    if (panel.classList.contains('show')) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Add a message about getting detailed directions
        const directionsContent = document.querySelector('#directionsPanel .route-info');
        if (directionsContent && !document.querySelector('.directions-message')) {
            const message = document.createElement('div');
            message.className = 'directions-message';
            message.style.marginTop = '1rem';
            message.style.padding = '1rem';
            message.style.background = '#e8f4f8';
            message.style.borderRadius = '8px';
            message.innerHTML = `
                <h4>Turn-by-Turn Walking Directions</h4>
                <p style="margin-top: 0.5rem;">For detailed turn-by-turn directions:</p>
                <ol style="margin-left: 1.5rem; line-height: 1.8;">
                    <li>Click on any numbered location marker on the map</li>
                    <li>Your phone's map app can provide voice-guided navigation</li>
                    <li>Or use the Google/Apple Maps links below for the complete route</li>
                </ol>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                    <strong>💡 Tip:</strong> The purple line shows the approximate walking route through London's streets. 
                    The actual path may vary slightly based on current pedestrian access.
                </p>
            `;
            directionsContent.parentElement.insertBefore(message, directionsContent.nextSibling);
        }
    }
}

function downloadRoute() {
    // Create GPX file content
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>London Film & TV Walking Tour</name>
    <desc>A self-guided tour of film locations in the City of London</desc>
  </metadata>
  <wpt lat="51.5081" lon="-0.0985">
    <name>1. Millennium Bridge (Bankside)</name>
    <desc>Guardians of the Galaxy, James Bond: Spectre</desc>
  </wpt>
  <wpt lat="51.5138" lon="-0.0984">
    <name>2. St Paul's Cathedral</name>
    <desc>Mission Impossible: Fallout, Thor: The Dark World, Lawrence of Arabia</desc>
  </wpt>
  <wpt lat="51.5155" lon="-0.1019">
    <name>3. Old Bailey</name>
    <desc>Justice League, V for Vendetta</desc>
  </wpt>
  <wpt lat="51.5171" lon="-0.0996">
    <name>4. Postman's Park</name>
    <desc>Closer, Tomb Raider</desc>
  </wpt>
  <wpt lat="51.5185" lon="-0.1000">
    <name>5. Smithfield Market</name>
    <desc>Skyfall, I May Destroy You</desc>
  </wpt>
  <wpt lat="51.5188" lon="-0.1003">
    <name>6. St Bartholomew the Great</name>
    <desc>Four Weddings and a Funeral, Sherlock Holmes</desc>
  </wpt>
  <wpt lat="51.5200" lon="-0.0873">
    <name>7. Barbican Centre</name>
    <desc>Quantum of Solace, Luther, Skepta - Shutdown</desc>
  </wpt>
  <wpt lat="51.5138" lon="-0.0886">
    <name>8. Cornhill & Royal Exchange</name>
    <desc>Bridget Jones's Diary, 28 Days Later, National Treasure 2</desc>
  </wpt>
  <wpt lat="51.5129" lon="-0.0835">
    <name>9. Leadenhall Market</name>
    <desc>Harry Potter, Tomb Raider, Proof of Life</desc>
  </wpt>
  <wpt lat="51.5055" lon="-0.0754">
    <name>10. Tower Bridge</name>
    <desc>Spider-Man: Far From Home, Brannigan, The Mummy Returns</desc>
  </wpt>
</gpx>`;
    
    // Create download link
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'london-film-tour.gpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Show location details in modal
function showDetails(locationId) {
    const details = locationDetails[locationId];
    const modalContent = document.getElementById('modalContent');
    
    let filmDetailsHTML = details.films.map(film => `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <h4 style="color: var(--accent-color); margin-bottom: 0.5rem;">${film.title}</h4>
            <p>${film.detail}</p>
        </div>
    `).join('');
    
    modalContent.innerHTML = `
        <h2 style="color: var(--primary-color); margin-bottom: 1rem;">${details.title}</h2>
        <p style="font-size: 1.1rem; margin-bottom: 2rem;">${details.description}</p>
        <h3 style="margin-bottom: 1rem;">Featured Films & Shows</h3>
        ${filmDetailsHTML}
        <div style="margin-top: 2rem; padding: 1rem; background: #e8f4f8; border-radius: 8px;">
            <h4 style="margin-bottom: 0.5rem;">Visitor Tips</h4>
            <p>${details.tips}</p>
        </div>
    `;
    
    document.getElementById('detailModal').style.display = 'block';
}

// Show bonus location details in modal
function showBonusDetails(locationId) {
    const details = bonusLocationDetails[locationId];
    if (!details) return;
    
    const modalContent = document.getElementById('modalContent');
    
    let filmDetailsHTML = details.films.map(film => `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <h4 style="color: var(--accent-color); margin-bottom: 0.5rem;">${film.title}</h4>
            <p>${film.detail}</p>
        </div>
    `).join('');
    
    modalContent.innerHTML = `
        <h2 style="color: var(--primary-color); margin-bottom: 1rem;">${details.title}</h2>
        <span style="background: #4ecdc4; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">Bonus Location</span>
        <p style="font-size: 1.1rem; margin-top: 1rem; margin-bottom: 2rem;">${details.description}</p>
        <h3 style="margin-bottom: 1rem;">Featured Films & Shows</h3>
        ${filmDetailsHTML}
        <div style="margin-top: 2rem; padding: 1rem; background: #e8f4f8; border-radius: 8px;">
            <h4 style="margin-bottom: 0.5rem;">Visitor Tips</h4>
            <p>${details.tips}</p>
        </div>
    `;
    
    document.getElementById('detailModal').style.display = 'block';
}

// Update route to include selected bonus locations
async function updateRouteWithBonusLocations() {
    // Show loading spinner
    showMapLoading();
    
    try {
        // Get all selected bonus locations
        const selectedBonusIds = Array.from(includedBonusLocations);
        
        if (selectedBonusIds.length === 0) {
            // No bonus locations, restore original route
            await drawRoute();
            return;
        }
        
        // Start with main locations only
        const mainLocations = Object.entries(locationCoordinates).map(([id, loc]) => ({
            ...loc,
            id: id,
            isBonus: false
        }));
        
        // Add bonus locations optimally
        let optimizedRoute = [...mainLocations];
        
        for (const bonusId of selectedBonusIds) {
            const bonusLoc = {
                ...bonusLocations[bonusId],
                id: bonusId,
                isBonus: true
            };
            
            // Find best insertion point
            const insertIndex = findBestInsertionPoint(optimizedRoute, bonusLoc);
            optimizedRoute.splice(insertIndex, 0, bonusLoc);
        }
        
        currentRouteOrder = optimizedRoute;
        
        // Remove existing route layer
        if (routeLayer) {
            map.removeLayer(routeLayer);
        }
        
        // Draw new route
        await drawOptimizedRoute(optimizedRoute);
        
        // Update statistics
        updateRouteStats();
    } finally {
        // Hide loading spinner
        hideMapLoading();
    }
}

// Find best insertion point for a bonus location
function findBestInsertionPoint(route, bonusLoc) {
    let minDistance = Infinity;
    let bestIndex = 0;
    let isClosestToStart = false;
    let isClosestToEnd = false;
    
    // Check distance to start
    const startDistance = calculateDistance(bonusLoc, route[0]);
    if (startDistance < minDistance) {
        minDistance = startDistance;
        bestIndex = 0;
        isClosestToStart = true;
    }
    
    // Check distance to end
    const endDistance = calculateDistance(bonusLoc, route[route.length - 1]);
    if (endDistance < minDistance) {
        minDistance = endDistance;
        bestIndex = route.length;
        isClosestToStart = false;
        isClosestToEnd = true;
    }
    
    // Check inserting between each pair of locations
    for (let i = 0; i < route.length - 1; i++) {
        const distToFirst = calculateDistance(bonusLoc, route[i]);
        const distToSecond = calculateDistance(bonusLoc, route[i + 1]);
        
        // Find which of the pair is closer
        const closerDistance = Math.min(distToFirst, distToSecond);
        
        if (closerDistance < minDistance) {
            minDistance = closerDistance;
            // If closer to the first of the pair, insert after it
            // If closer to the second of the pair, insert before it (same as after first)
            bestIndex = i + 1;
            isClosestToStart = false;
            isClosestToEnd = false;
        }
    }
    
    // If closest to start or end, make it the new start/end
    // Otherwise insert between locations
    return bestIndex;
}

// Calculate distance between two locations
function calculateDistance(loc1, loc2) {
    const R = 6371; // km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Draw optimized route using cached segments where possible
async function drawOptimizedRoute(locations) {
    let fullRoute = [];
    
    console.log('Drawing optimized route for', locations.length, 'locations');
    
    // Process each segment
    for (let i = 0; i < locations.length - 1; i++) {
        const start = locations[i];
        const end = locations[i + 1];
        const cacheKey = `${start.lat},${start.lng}->${end.lat},${end.lng}`;
        
        // Check cache first
        if (routeCache.has(cacheKey)) {
            console.log('Using cached route for segment', i);
            const cachedSegment = routeCache.get(cacheKey);
            fullRoute = fullRoute.concat(cachedSegment);
        } else {
            console.log('Calculating new route for segment', i);
            // Calculate new route segment
            const segment = await calculateRouteSegment(start, end);
            if (segment && segment.length > 0) {
                routeCache.set(cacheKey, segment);
                fullRoute = fullRoute.concat(segment);
            } else {
                // Fallback to straight line
                fullRoute.push([start.lat, start.lng]);
                if (i === locations.length - 2) {
                    fullRoute.push([end.lat, end.lng]);
                }
            }
        }
    }
    
    // Create and display the route
    if (fullRoute.length > 1) {
        routeLayer = L.polyline(fullRoute, {
            color: '#05d9e8',
            weight: 4,
            opacity: 0.9,
            smoothFactor: 1,
            lineJoin: 'round',
            dashArray: '10, 5',
            className: 'neon-route'
        }).addTo(map);
        
        // Fit map to show entire route
        map.fitBounds(routeLayer.getBounds().pad(0.1));
        
        // Calculate and display total distance
        const totalDistance = calculateTotalDistance(fullRoute);
        const walkingTime = Math.ceil(totalDistance / 4.5 * 60); // 4.5 km/h walking speed
        
        updateDistanceDisplay(totalDistance, walkingTime);
        
        // Update route overview with new order
        updateRouteOverview();
    }
}

// Calculate route segment between two points
async function calculateRouteSegment(start, end) {
    try {
        const valhallaUrl = 'https://valhalla1.openstreetmap.de/route';
        
        const valhallaRequest = {
            locations: [
                { lat: start.lat, lon: start.lng },
                { lat: end.lat, lon: end.lng }
            ],
            costing: 'pedestrian',
            costing_options: {
                pedestrian: {
                    walking_speed: 5.1,
                    use_ferry: 0.5,
                    use_living_streets: 0.5,
                    use_tracks: 0.5,
                    service_penalty: 15,
                    service_factor: 1,
                    shortest: false
                }
            }
        };
        
        const response = await fetch(valhallaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(valhallaRequest)
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.trip && data.trip.legs && data.trip.legs[0]) {
            const shape = data.trip.legs[0].shape;
            return decodePolyline(shape);
        }
    } catch (error) {
        console.error('Error calculating route segment:', error);
    }
    
    return null;
}

// Update route statistics
function updateRouteStats() {
    const mainCount = Object.keys(locationCoordinates).length;
    const bonusCount = includedBonusLocations.size;
    
    // Update location count
    const routeStats = document.querySelectorAll('.route-stat');
    routeStats.forEach(stat => {
        const label = stat.querySelector('.route-stat-label');
        const value = stat.querySelector('.route-stat-value');
        
        if (label && value && label.textContent === 'Film Locations') {
            value.textContent = bonusCount > 0 ? `${mainCount} + ${bonusCount}` : mainCount.toString();
        }
    });
    
    // Update route overview list
    updateRouteOverview();
}

// Update route overview list
function updateRouteOverview() {
    const routeList = document.querySelector('.route-list');
    if (!routeList) return;
    
    // Clear existing list
    routeList.innerHTML = '';
    
    // If no current route order, use default
    if (currentRouteOrder.length === 0) {
        // Use default route
        const defaultRoute = [
            'Millennium Bridge → St Paul\'s Cathedral (5 min walk)',
            'St Paul\'s Cathedral → Old Bailey (7 min walk)',
            'Old Bailey → Postman\'s Park (5 min walk)',
            'Postman\'s Park → Smithfield Market (8 min walk)',
            'Smithfield Market → St Bartholomew the Great (3 min walk)',
            'St Bartholomew the Great → Barbican Centre (10 min walk)',
            'Barbican Centre → Cornhill & Royal Exchange (12 min walk)',
            'Cornhill & Royal Exchange → Leadenhall Market (8 min walk)',
            'Leadenhall Market → Tower Bridge (15 min walk)'
        ];
        
        defaultRoute.forEach(step => {
            const li = document.createElement('li');
            const parts = step.split(' → ');
            li.innerHTML = `<strong>${parts[0]}</strong> → ${parts[1]}`;
            routeList.appendChild(li);
        });
        return;
    }
    
    // Build route with current order including bonus locations
    for (let i = 0; i < currentRouteOrder.length - 1; i++) {
        const current = currentRouteOrder[i];
        const next = currentRouteOrder[i + 1];
        
        const li = document.createElement('li');
        const currentName = current.name.replace(' (Bankside)', '');
        const nextName = next.name.replace(' (Bankside)', '');
        
        // Estimate walking time based on distance
        const distance = calculateDistance(current, next);
        const walkingTime = Math.ceil(distance * 12); // Rough estimate: 12 min per km
        
        // Add bonus indicator if needed
        const currentLabel = current.isBonus ? `${currentName} <span style="color: var(--neon-purple); font-size: 0.8em;">(Bonus)</span>` : currentName;
        const nextLabel = next.isBonus ? `${nextName} <span style="color: var(--neon-purple); font-size: 0.8em;">(Bonus)</span>` : nextName;
        
        li.innerHTML = `<strong>${currentLabel}</strong> → ${nextLabel} (${walkingTime} min walk)`;
        routeList.appendChild(li);
    }
}

// Update distance display
function updateDistanceDisplay(distanceKm, walkingTime) {
    const distanceMiles = (distanceKm * 0.621371).toFixed(1);
    
    const routeStats = document.querySelectorAll('.route-stat');
    routeStats.forEach(stat => {
        const label = stat.querySelector('.route-stat-label');
        const value = stat.querySelector('.route-stat-value');
        
        if (label && value) {
            if (label.textContent === 'Total Distance') {
                value.textContent = `${distanceMiles} mi`;
            } else if (label.textContent === 'Walking Time') {
                const hours = Math.floor(walkingTime / 60);
                const mins = walkingTime % 60;
                value.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            }
        }
    });
}

// Calculate total distance of a route
function calculateTotalDistance(coordinates) {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const latlng1 = L.latLng(coordinates[i]);
        const latlng2 = L.latLng(coordinates[i + 1]);
        totalDistance += latlng1.distanceTo(latlng2);
    }
    return totalDistance / 1000; // Convert to kilometers
}

// Close modal
function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('detailModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add some animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all location cards
document.querySelectorAll('.location-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(card);
});

// Global variables for the map
let map;
let routeLayer;
let includedBonusLocations = new Set(); // Track which bonus locations are included in the route
let routeCache = new Map(); // Cache calculated routes between points
let currentRouteOrder = []; // Track current order of locations in the route

// Helper functions for loading spinner
function showMapLoading() {
    const overlay = document.getElementById('mapLoadingOverlay');
    if (overlay) {
        overlay.classList.add('show');
    }
}

function hideMapLoading() {
    const overlay = document.getElementById('mapLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// Location coordinates
const locationCoordinates = {
    1: { lat: 51.5081, lng: -0.0985, name: "Millennium Bridge (Bankside)" }, // Updated to Bankside landing
    2: { lat: 51.5138, lng: -0.0984, name: "St Paul's Cathedral" },
    3: { lat: 51.5155, lng: -0.1019, name: "Old Bailey" },
    4: { lat: 51.5171, lng: -0.0996, name: "Postman's Park" },
    5: { lat: 51.5185, lng: -0.1000, name: "Smithfield Market" },
    6: { lat: 51.5188, lng: -0.1003, name: "St Bartholomew the Great" },
    7: { lat: 51.5200, lng: -0.0873, name: "Barbican Centre" },
    8: { lat: 51.5138, lng: -0.0886, name: "Cornhill & Royal Exchange" },
    9: { lat: 51.5129, lng: -0.0835, name: "Leadenhall Market" },
    10: { lat: 51.5055, lng: -0.0754, name: "Tower Bridge" }
};

// Bonus location coordinates
const bonusLocations = {
    11: { lat: 51.5142, lng: -0.1053, name: "Temple Church" },
    12: { lat: 51.5143, lng: -0.1068, name: "Fleet Street" },
    13: { lat: 51.5119, lng: -0.0993, name: "College of Arms" },
    14: { lat: 51.5179, lng: -0.0819, name: "Liverpool Street Station" },
    15: { lat: 51.5142, lng: -0.0803, name: "The Gherkin (30 St Mary Axe)" },
    16: { lat: 51.5130, lng: -0.0821, name: "Lloyd's Building" },
    17: { lat: 51.5095, lng: -0.0827, name: "Minster Court" },
    18: { lat: 51.5130, lng: -0.0937, name: "Mansion House" },
    19: { lat: 51.5158, lng: -0.0919, name: "Guildhall" },
    20: { lat: 51.5190, lng: -0.0821, name: "Broadgate Circle" },
    21: { lat: 51.5234, lng: -0.0870, name: "Citypoint" },
    22: { lat: 51.5090, lng: -0.1032, name: "Blackfriars Bridge" }
};

// Initialize the map
function initializeMap() {
    // Show loading spinner during initial map setup
    showMapLoading();
    
    // Create the map centered on the City of London
    map = L.map('map-container').setView([51.5138, -0.0886], 14);

    // Add OpenStreetMap tiles with dark styling via CSS
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        className: 'map-tiles-dark'
    }).addTo(map);

    // Create custom icon for film locations
    const filmIcon = L.divIcon({
        html: '<div style="background: #667eea; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });

    // Add markers for each location
    Object.entries(locationCoordinates).forEach(([id, location]) => {
        const marker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
                html: `<div style="background: #ff2a6d; color: #0a0a0a; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid #ff2a6d; box-shadow: 0 0 20px #ff2a6d, 0 2px 10px rgba(0,0,0,0.8); font-family: 'Courier New', monospace;">${id}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -15],
                className: 'custom-div-icon'
            })
        }).addTo(map);

        // Add popup with location name
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `<strong>${id}. ${location.name}</strong><br><a href="#" class="popup-details-link" data-location="${id}">View Details</a>`;
        marker.bindPopup(popupContent);
        
        // Add click handler to popup link after popup opens
        marker.on('popupopen', function() {
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
                const link = document.querySelector('.popup-details-link[data-location="' + id + '"]');
                if (link && !link.hasAttribute('data-listener-attached')) {
                    link.setAttribute('data-listener-attached', 'true');
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        const locId = parseInt(this.getAttribute('data-location'));
                        showDetails(locId);
                        map.closePopup();
                    });
                }
            }, 50);
        });
    });

    // Add bonus location markers with different color
    Object.entries(bonusLocations).forEach(([id, location]) => {
        const marker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
                html: `<div style="background: #d100d1; color: #0a0a0a; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid #d100d1; box-shadow: 0 0 15px #d100d1, 0 2px 8px rgba(0,0,0,0.8); font-family: 'Courier New', monospace;">B</div>`,
                iconSize: [25, 25],
                iconAnchor: [12.5, 12.5],
                popupAnchor: [0, -12.5],
                className: 'custom-div-icon'
            })
        }).addTo(map);

        // Add popup with location name, view details link, and add to route checkbox
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `
            <strong>${location.name}</strong><br>
            <span style="font-size: 0.9em; color: #666;">Bonus Location</span><br>
            <a href="#" class="bonus-details-link" data-location="${id}" style="color: #667eea; text-decoration: none;">View Details</a><br>
            <label style="margin-top: 8px; display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" class="add-to-route-checkbox" data-location="${id}" style="margin-right: 6px;">
                <span style="font-size: 0.9em;">Add to route</span>
            </label>
        `;
        marker.bindPopup(popupContent);
        
        // Store marker reference for later use
        location.marker = marker;
        location.id = id;
        
        // Add event handler when popup opens
        marker.on('popupopen', function() {
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
                // Handle view details link
                const detailsLink = document.querySelector('.bonus-details-link[data-location="' + id + '"]');
                if (detailsLink && !detailsLink.hasAttribute('data-listener-attached')) {
                    detailsLink.setAttribute('data-listener-attached', 'true');
                    detailsLink.addEventListener('click', function(e) {
                        e.preventDefault();
                        const locId = parseInt(this.getAttribute('data-location'));
                        showBonusDetails(locId);
                        map.closePopup();
                    });
                }
                
                // Handle add to route checkbox
                const checkbox = document.querySelector('.add-to-route-checkbox[data-location="' + id + '"]');
                if (checkbox && !checkbox.hasAttribute('data-listener-attached')) {
                    checkbox.setAttribute('data-listener-attached', 'true');
                    // Set initial state based on whether location is in route
                    checkbox.checked = includedBonusLocations.has(id);
                    
                    checkbox.addEventListener('change', function(e) {
                        const locId = this.getAttribute('data-location');
                        if (this.checked) {
                            includedBonusLocations.add(locId);
                        } else {
                            includedBonusLocations.delete(locId);
                        }
                        
                        // Close the popup
                        map.closePopup();
                        
                        // Recalculate route with new locations
                        updateRouteWithBonusLocations();
                    });
                }
            }, 50); // Small delay to ensure popup content is rendered
        });
    });

    // Draw the walking route
    drawRoute();
    
    // Initialize route overview
    updateRouteOverview();
}

// Draw the walking route between locations
async function drawRoute() {
    showMapLoading();
    try {
        const locations = Object.values(locationCoordinates);
        currentRouteOrder = locations.map((loc, idx) => ({ 
            ...loc, 
            id: (idx + 1).toString(),
            isBonus: false 
        }));
        await drawRouteWithLocations(currentRouteOrder);
    } finally {
        hideMapLoading();
    }
}

// Draw route with specific locations
async function drawRouteWithLocations(locations) {
    // Remove existing route
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    // Use the optimized route drawing function
    await drawOptimizedRoute(locations);
    
    // Fit the map to show the entire route
    if (routeLayer) {
        map.fitBounds(routeLayer.getBounds().pad(0.1));
    }
}

// Decode Valhalla polyline format (polyline6)
function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    
    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte;
        
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        
        shift = 0;
        result = 0;
        
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        
        // Valhalla uses precision 6 (divide by 1e6)
        points.push([lat / 1e6, lng / 1e6]);
    }
    
    return points;
}


// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the interactive map
    initializeMap();

    // Add event listeners for map buttons
    const viewFullRouteBtn = document.getElementById('viewFullRouteBtn');
    if (viewFullRouteBtn) {
        viewFullRouteBtn.addEventListener('click', showFullRoute);
    }

    const getDirectionsBtn = document.getElementById('getDirectionsBtn');
    if (getDirectionsBtn) {
        getDirectionsBtn.addEventListener('click', function() {
            getDirections();
        });
    }

    const downloadRouteBtn = document.getElementById('downloadRouteBtn');
    if (downloadRouteBtn) {
        downloadRouteBtn.addEventListener('click', downloadRoute);
    }

    // Add event listeners for location cards
    document.querySelectorAll('.location-card').forEach(card => {
        card.addEventListener('click', function() {
            const locationId = parseInt(this.getAttribute('data-location'));
            if (locationId) {
                showDetails(locationId);
            }
        });
    });

    // Add event listener for modal close button
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
});