/*
Welcome to ASBY Scheduler!
See how to get started in depth: 
https://docs.google.com/document/d/1tGxXGC6ICAQgjZqcLupNdqaqXt1RwU_mv3O4ja9-D8k/edit?usp=sharing

Get statrted TLDR:
1. Update the following variables in Settings.js:
  - MyBase, MyName, MyCredentials
2. This runs on JavaScript. Make sure you have Node.js installed
3. Update the variables below: targetDay, targetMonth
4. To run the script, open the terminal and type 'node index.js'

This will output the schedule, 

Notes:
- You must be on reserve to run the code for the target month. 
  - This is because the code uses two-way-trades to fetch people's schedules
  - If you are not reserve, you cannot two-way-trade reserves and thus cannot view their schedule
- Two-way-trade list updates on the first of every month, so grabbing ASBY on the first of the month can only be done after 00:00 the same day
*/

// Imports
import DataFetching from './Modules/DataFetching.js'
import Settings from './Modules/Settings.js'
import Variables from './Modules/Variables.js'
import Functions from './Modules/Functions.js'

import fs from 'fs'
import { parse } from 'node-html-parser'

// Variables

// Which day of the month (1-31) you want the schedule of
let targetDay = 17

// Which month of the year (1-12) you want the schedule of
let targetMonth = 11 

// Whether or not the flights are guessed for ASBY
let GET_FLIGHT_OPS = true // Whether or not 

// Whether or not addional data like Flight Hours and Time since last ASBY is logged 
let PRINT_ADDITIONAL_DATA = true

// Whether or not station operations write to a text file named reponse.txt
let USE_FILE = false
let WRITE_TO_FILE = false

// Functions
let AIRPORT_CODE = Settings.MyBase
async function getAllReserveSchedules(){

  let activePeopleRequest = await DataFetching.GetActivePeople()
  await DataFetching.UpdateRequestData(activePeopleRequest)

  let data = activePeopleRequest && await activePeopleRequest.json()
  let peopleTable = data && data.results || {}

  // Insert the local person running the program's schedule
  let localSchedule = {
    id: -1,
    name: Settings.MyName,
  }
  peopleTable.push(localSchedule)

  // Add additional schedules stored in settings
  let Additional = Settings.otherSchedules || []
  for (var index in Additional){
      peopleTable.push(Additional[index])
  }

  let BaseInfo = Variables.BaseInfo[AIRPORT_CODE] || {}

  // Check people table, grab schedule data for each user
  for (var index in peopleTable){

    let personData = peopleTable[index]

    let scheduleForRequest = await DataFetching.GetScheduleForUser(BaseInfo.BaseId, personData.id)
    let data = scheduleForRequest && await scheduleForRequest.json()
    let scheduleTable = data && data.results || {}
    personData.schedule = scheduleTable

  }

  // Sort table
  peopleTable.sort((a, b) => a.id - b.id);

  // Return table with IDs
  return peopleTable

}

async function checkStandbyToday(){

  let scheduleAtDay = []
  let TodayTimestamp = new Date(Date.now())

  if (targetDay == 0){
    targetDay = TodayTimestamp.getDate()
  }

  if (!targetMonth || targetMonth == 0){
    targetMonth = TodayTimestamp.getMonth() + 1
  }

  let allSchedules = await getAllReserveSchedules()
  
  for (var index in allSchedules){

    let userData = allSchedules[index]
    let userSchedule = userData.schedule
    let scheduleAtDayForUser = null

    let lastStandby
    let flightHours = 0

    for (var dayindex in userSchedule){

      let daySchedule = userSchedule[dayindex]
      let dayTimestamp = new Date(daySchedule.date)
      let DayOfEvent = dayTimestamp.getDate()
      let MonthOfEvent = dayTimestamp.getMonth() + 1

      if (MonthOfEvent != targetMonth){
        continue
      }

      // On day of, set the schedule info
      if (DayOfEvent == targetDay){
        scheduleAtDayForUser = daySchedule
      } else if (DayOfEvent < targetDay){

        // Get flight hours assigned prior to date
        if (daySchedule.isPairing){

          let Split = daySchedule.credit.split(":")
          let Hours = Split[0]
          let Minutes = Split[1]

          if (!Hours){
            continue
          }
          
          Hours = Number(Hours)
          Minutes = Number(Minutes)
          
          let TotalHours = Hours + (Minutes / 60)
          flightHours += TotalHours

        } else if (daySchedule.activityCode == "ASBY"){

          // Get last ASBY assignment time
          let CheckIn = new Date(daySchedule.activityCheckin)
          let CheckOut = new Date(daySchedule.activityCheckout)

          let onlyCount2HourAsby = false
          if (onlyCount2HourAsby){
            let MsInHour = 1000 * 60 * 60
            if ((CheckOut - CheckIn) / (MsInHour) < 2 ){
              continue
            }
          }

          if (!lastStandby || lastStandby < CheckIn){
            lastStandby = CheckIn
          }

        }

      }

    }

    if (scheduleAtDayForUser){

      let dayInfo = {
        name: userData.name,
        schedule: scheduleAtDayForUser,
        lastStandby: lastStandby,
        flightHours: flightHours,
      }

      let NameTable = userData.name.split(",")
      let firstName = NameTable[1].trim()
      let NameFormat = `${firstName} ${NameTable[0].charAt(0)}.`
      dayInfo.nameText = NameFormat

      scheduleAtDay.push(dayInfo)
    }

  }

  // Get operations
  let Operations = []
  if (GET_FLIGHT_OPS){
      Operations = await getOperationsToday()
  }
  
  // Compile for output
  let OFFPeople = []
  let ASBYPeople = []
  let FlightPeople = []
  let OtherPeople = []

  for (var index in scheduleAtDay){

    let scheduleUser = scheduleAtDay[index]
    let userSchedule = scheduleUser.schedule

    let UserInfo = {
      name: scheduleUser.name,
      nameText: scheduleUser.nameText,
      flightHours: scheduleUser.flightHours,
    }

    // Check elapsed for ASBY
    let DateTimestamp = new Date(Date.now())
    DateTimestamp.setUTCHours(0)
    DateTimestamp.setUTCMinutes(0)
    DateTimestamp.setUTCDate(targetDay)

    if (scheduleUser.lastStandby){
      let ElapsedMs = DateTimestamp - scheduleUser.lastStandby
      let MsInDay = 1000 * 60 * 60 * 24
      let ElapsedDays = ElapsedMs / MsInDay
      ElapsedDays = Math.round(ElapsedDays * 100) / 100;
      UserInfo.asbyElapsed = ElapsedDays
    }

    if (userSchedule.activityCode == "OFF"){

      OFFPeople.push(UserInfo)

    } else if (userSchedule.activityCode == "ASBY"){

      // Check for ILM ASBY
      let asbyAirportCode = AIRPORT_CODE
      for (var scheduleIndex in userSchedule.selectedActivities){
        let ActivityRef = userSchedule.selectedActivities[scheduleIndex]
        if (ActivityRef.activityCode == "ASBY"){
          asbyAirportCode = ActivityRef.dep
        }
      }

      if (asbyAirportCode == AIRPORT_CODE){

        UserInfo.start = new Date(userSchedule.activityCheckin)
        UserInfo.end = new Date(userSchedule.activityCheckout)
        ASBYPeople.push(UserInfo)

      } else {

        UserInfo.activity = `ASBY, ${asbyAirportCode}`
        OtherPeople.push(UserInfo)

      }
    } else if (userSchedule.isPairing){

        UserInfo.start = new Date(userSchedule.activityCheckin)
        UserInfo.end = new Date(userSchedule.activityCheckout)
        FlightPeople.push(UserInfo)

    } else {

      UserInfo.activity = userSchedule.activityCode
      OtherPeople.push(UserInfo)

    }

  }

  // ASBY
  let CoveredFlights = []
  let HasAsby = false

  let Day = new Date(Date.now())
  let DateString = `${targetMonth}/${targetDay}/${Day.getUTCFullYear()}`

  if (ASBYPeople.length > 0){

    // Sort ASBY by time
    HasAsby = true
    ASBYPeople.sort((a, b) => a.start - b.start);

    console.log(`${DateString} ASBY:`)

    let PeoplePrints = []
    for (var asbyIndex = ASBYPeople.length - 1; asbyIndex >= 0; asbyIndex--){

      let person = ASBYPeople[asbyIndex]
      let StartTime = Functions.GetTime(person.start)
      let EndTime = Functions.GetTime(person.end)
      
      person.start.setUTCHours(person.start.getHours())
      person.end.setUTCHours(person.end.getHours())
      
      let startMinutes = (person.start.getUTCHours() * 60) + person.start.getUTCMinutes() 
      let endMinutes = (person.end.getUTCHours() * 60) + person.end.getUTCMinutes() 

      // Get shift covers
      let coveringFlights = ""
      for (var index in Operations){
        let flightData = Operations[index]
        let departureMinutes = (flightData.departureTimestamp.getUTCHours() * 60) + flightData.departureTimestamp.getUTCMinutes() 

        let IsBetweenStartAndEnd = departureMinutes > startMinutes && endMinutes > departureMinutes
        if (IsBetweenStartAndEnd && !CoveredFlights.includes(index)){
          
          let isFirst = coveringFlights == ""
          if (!isFirst){
            coveringFlights += ", "
          }
          
          coveringFlights += `${flightData.flightNumber} @ ${flightData.departureTime.slice(0,2)}:${flightData.departureTime.slice(-2)}`
          
          // Add to tracked table
          CoveredFlights.push(index)

        }
      }
            
      let publishString = `- ${person.nameText} (${StartTime} - ${EndTime})`
      if (coveringFlights != ""){
        publishString += ` | Covering: ${coveringFlights}`
      }
      PeoplePrints.push(publishString)
    }

    // Do the console logs at the end, printing them backwards (since we iterate through the table backwards)
    PeoplePrints.slice().reverse().forEach(ASBYPrint => {
      console.log(ASBYPrint)
    })

  }

  let unsureCoverage = ""
  for (var index in Operations){
    
    if (!CoveredFlights.includes(index)){

      let isFirst = unsureCoverage == ""
      if (!isFirst){
        unsureCoverage += ", "
      }

      let flightData = Operations[index]
      unsureCoverage += `${flightData.flightNumber} @ ${flightData.departureTime.slice(0,2)}:${flightData.departureTime.slice(-2)}`
    }

  }

  if (unsureCoverage != ""){
    if (!HasAsby){
    console.log(`${DateString} FLIGHTS:`)
    }
    console.log(`- Coverage Unsure | ${unsureCoverage}`)
  } else {
    if (!HasAsby){
      console.log(`${DateString}: NO FLIGHTS`)
    }
  }

  // Flying
  if (FlightPeople.length > 0){
    console.log("FLYING:")
    for (var index in FlightPeople){
      let person = FlightPeople[index]
      console.log(`- ${person.nameText}`)
    }
  }

  // OFF
  if (OFFPeople.length > 0){
    console.log("OFF:")
    for (var index in OFFPeople){
      let person = OFFPeople[index]

      let publishString = `- ${person.nameText}`
      if (PRINT_ADDITIONAL_DATA){
        
        if (person.flightHours){
          let FlightHours = person.flightHours
          let RoundedHours = Math.floor(FlightHours)
          let MinuteFraction = FlightHours % 1
          let MinuteCount = MinuteFraction * 60
          MinuteCount = Math.round(MinuteCount)
          publishString += ` (${RoundedHours}:${MinuteCount < 10 && "0"+MinuteCount || MinuteCount} FH)`
        }

        if (person.asbyElapsed){
          let AsbyHours = person.asbyElapsed * 24
          let RoundedHours = Math.floor(AsbyHours)
          publishString += ` (${RoundedHours}h LSBY)`
        }

      }

      console.log(publishString)
    }
  }

  // OTHER
  if (OtherPeople.length > 0){
    console.log("OTHER:")
    for (var index in OtherPeople){

      let person = OtherPeople[index]
      let publishString = `- ${person.nameText} (${person.activity})`
      if (PRINT_ADDITIONAL_DATA){
        
        if (person.flightHours){
          let FlightHours = person.flightHours
          let RoundedHours = Math.floor(FlightHours)
          let MinuteFraction = FlightHours % 1
          let MinuteCount = MinuteFraction * 60
          MinuteCount = Math.round(MinuteCount)
          publishString += ` (${RoundedHours}:${MinuteCount < 10 && "0"+MinuteCount || MinuteCount} FH)`
        }

        if (person.asbyElapsed){
          let AsbyHours = person.asbyElapsed * 24
          let RoundedHours = Math.floor(AsbyHours)
          publishString += ` (${RoundedHours}h LSBY)`
        }

      }

      console.log(publishString)
    }
  }

}

async function getOperationsToday(){
  
    let Today = new Date(Date.now())
    if (targetDay != 0){
      Today.setDate(targetDay)
      Today.setMonth(targetMonth - 1)
    }
    
    let data = null

    if (USE_FILE){
        let ReadPromise = new Promise((accept, reject) => {
        let filePath = "./response.txt"
        fs.readFile(filePath, (error, data) => {
          if (error){
            reject(error)
          } else {
            accept(data)
          }
        })
      })
      
      data = await ReadPromise
    } else {

      let opsData = await DataFetching.GetStationOperations(AIRPORT_CODE, Today)
      if(!opsData){
        console.log("Failed to fetch departures")
        console.log("error:",opsData)
        return false
      }

      if(opsData.status != 200){
        return false, "failed to fetch data. error not noted"
      }

      // Update and get data
      await DataFetching.UpdateRequestData(opsData)
      data = await opsData.text()

      if (WRITE_TO_FILE) {
        let filePath = "./response.txt"
        fs.writeFile(filePath, data, (err) => {
          if (err) throw err;
          console.log('File saved!');
        });
      }
    }
    
    let root = parse(data)
    let Departures = root.getElementById('MasterMain_panelUpper')
    
    if (!Departures){
      console.log("No departures found")
      return false
    }
    
    let departureTable = []
    for (var index in Departures.childNodes){
      
      let ref = Departures.childNodes[index]
      //console.log(index, ref)
      if (!ref || !ref.querySelector){
        continue
      }
      
      let activityRow = ref.querySelector(".ActivityInfoRow")
      if (activityRow){
        
        let FlightNumber = activityRow.childNodes[1].text
        let DepartureTime = activityRow.childNodes[2].text
        let DestinationCity = activityRow.childNodes[4].text

        let DepartureHours = Number(DepartureTime.slice(0,2))
        let DepartureMinutes = Number(DepartureTime.slice(-2))

        let NewTimestamp = new Date(Today.getTime())
        NewTimestamp.setUTCHours(DepartureHours, DepartureMinutes)
        
        let FlightMetadata = {
          flightNumber: FlightNumber,
          departureTime: DepartureTime,
          departureTimestamp: NewTimestamp,
          destinationCity: DestinationCity,
        }
        
        departureTable.push(FlightMetadata)
                  
      }
    }
    
  return departureTable
    
}

async function getRoster(id){

  let activePeopleRequest = await DataFetching.GetSchedulePrimary(id)
  console.log(activePeopleRequest)
  let data = activePeopleRequest && await activePeopleRequest.json()

  console.log(data)

}

async function Check(){
  
    let Credentials = await DataFetching.GetOperationsCredentials("HVN")
}

//Check()

// Run the actual code
checkStandbyToday()

// Created by Matty B.