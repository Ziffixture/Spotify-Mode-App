// Imports
import SpotifyWebAPI from "spotify-web-api-node"
import express from "express"
import open from "open"


// Variables
const SHOW_RAW = true
const REQUEST_SIZE_LIMIT = 50

const app = express()

const API = new SpotifyWebAPI({
    clientId:       process.env.CLIENT_ID,
    clientSecret:   process.env.CLIENT_SECRET,
    redirectUri:    process.env.REDIRECT_URI,
})


// Functions
async function authRoute(request) {
    try {
        const response = await API.authorizationCodeGrant(request.query.code)
    
        API.setAccessToken(response.body.access_token)
        API.setRefreshToken(response.body.refresh_token)
    
        await main()
    } catch (error) {
        console.log(error)
    }
} 

async function exhaustInformation(APICallback) {
    let information = []
    let index = 0

    while (true) {
        let response = await APICallback({
            limit: REQUEST_SIZE_LIMIT,
            offset: REQUEST_SIZE_LIMIT * index
        })

        response = response.body

        information.push(...response.items)
    
        if (response.next)
            index += 1
        else
            break
    } 

    return information
}

async function compileAllPlaylistTracks() {
    let allTracks = []
    
    const playlists = await exhaustInformation(options =>
        API.getUserPlaylists(options)    
    )

    for (const playlist of playlists) {
        const tracks = await exhaustInformation(options => 
            API.getPlaylistTracks(playlist.id, options)
        )

        allTracks.push(...tracks)
    }

    return allTracks
}

async function main() {
    try {
        const tracks = await compileAllPlaylistTracks()

        let tracksVisited = {}

        let yearTotalLargest = 0
        let yearTotals = {}
        let yearModes = []
        let year = undefined

        let increment = 0

        for (const {track} of tracks) {
            if (track.is_local)
                continue

            if (tracksVisited[track.id] == undefined)
                tracksVisited[track.id] = true
            else
                continue

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




// Setup
open(API.createAuthorizeURL(["playlist-read-private", "playlist-read-collaborative"]))

app.get("/auth", authRoute)
app.listen(3000)