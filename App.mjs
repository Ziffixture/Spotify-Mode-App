/*
Author:     Ziffix
Version:    1.0.0
Date:       23/04/30
*/



import SpotifyWebAPI from "spotify-web-api-node"
import express from "express"
import open from "open"



const SHOW_RAW = true
const REQUEST_SIZE_LIMIT = 50


const app = express()

const api = new SpotifyWebAPI({
    clientId:        process.env.CLIENT_ID,
    clientSecret:    process.env.CLIENT_SECRET,
    redirectUri:     process.env.REDIRECT_URI,
})



async function authRoute(request) {
    try {
        const response = await api.authorizationCodeGrant(request.query.code)
    
        api.setAccessToken(response.body.access_token)
    
        await downloadAndProcessTracks()
    } 
    catch (error) {
        console.log(error)
    }
} 


/*
Fetches all items using pagination for a given function from the Spotify Web API Node library.

@param Function method - The function from the Spotify Web API Node library to call.
@param Function filter - A function to filter the items retrieved by the current pagination.

@return Promise
*/
async function getAllItems(method, filter) {
    let allItems = []
    let index = 0

    while (true) {
        let response = await method.call(api, {
            limit:     REQUEST_SIZE_LIMIT,
            offset:    REQUEST_SIZE_LIMIT * index,
        })

        response = response.body

        let items = response.items
        
        if (filter)
            items = items.filter(filter)

        allItems.push(...items)

        if (response.next)
            index++
        else
            break
    } 

    return items
}

async function downloadUniqueTracks() {
    const playlists = await getAllItems(api.getUserPlaylists)
    
    const uniqueTracks = []
    const visitedTracks = {}

    const filterDuplicateTracks = (track) => {
        track = track.track
        
        if (visitedTracks[track.id] == undefined && !track.is_local) {
            visitedTracks[track.id] = true

            return true
        }

        return false
    }
    
    for (const playlist of playlists) {
        const filteredTracks = await getAllItems((options) => api.getPlaylistTracks(playlist.id, options), filterDuplicateTracks)
        
        uniqueTracks.push(...filteredTracks)
    }
    
    return uniqueTracks
}

async function downloadAndProcessTracks() {
    try {
        const tracks = await downloadUniqueTracks()
        
        let yearTotalLargest = 0
        let yearTotals = {}
        let yearModes = []
        let year = undefined

        let increment = 0

        for (const {track} of tracks) {
            year = track.album.release_date.split("-")[0]
            increment = (yearTotals[year] || 0) + 1

            if (yearTotalLargest < increment)
                yearTotalLargest = increment

            yearTotals[year] = increment
        }

        if (!SHOW_RAW) {
            for (const [year, total] of Object.entries(yearTotals)) {
                if (yearTotalLargest == total) {
                    yearModes.push(year)
                }
            }

            console.log(`With ${yearTotalLargest} total songs, the years you listen to most are: ${yearModes.join(", ")}\n`)
        }
        else {
            console.log(yearTotals)
        }
    }
    catch (error) {
        console.log(error)
    }

    process.exit(0)
}



open(api.createAuthorizeURL(["playlist-read-private", "playlist-read-collaborative"]))

app.get("/auth", authRoute)
app.listen(3000)
