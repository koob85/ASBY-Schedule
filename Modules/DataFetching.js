// Fetch
import Settings from './Settings.js'

import Database from './DatabaseHandler.js'
import { parse } from 'node-html-parser'

// Tokens
let DefaultAvx = Settings.MyCredentials.AvxUserHash 
let DefaultAwsalb = Settings.MyCredentials.AWSALB
let DefaultAwsalbcors = Settings.MyCredentials.AWSALBCORS

let SetAvx
let SetAwsalb
let SetAwsalbcors
let SessionId

// Functions
async function GetCookie(){

	if (!SessionId){
		let Credentials = await Database.GetData("CookiesData")
		SetAvx = Credentials.AvxUserHash
		SetAwsalbcors = Credentials.AWSALBCORS
		SetAwsalb = Credentials.AWSALB
	}

	let Cookie = `AvxUserHash=${SetAvx || DefaultAvx}; AWSALB=${SetAwsalb || DefaultAwsalb}; AWSALBCORS=${SetAwsalbcors || DefaultAwsalbcors};`
	if (SessionId){
		Cookie += ` ASP.NET_SessionId=${SessionId};`
	}

	return Cookie

}

async function UpdateRequestData(Request){

	// Already got session id
	if (SessionId){
		return
	}

	// Make sure its an approved status
	if (Request.status != 200){
		return
	}

	// Get the headers and set them to data!
	let CookiesData = {}

	let DesiredKeys = ['AWSALB', 'AWSALBCORS', 'AvxUserHash']
	let Cookies = Request.headers.get('set-cookie')
	if (Cookies){

		// Loop through all header set cookies
		let CookiesTable = Cookies.split(",")
		for (let i = 0; i < CookiesTable.length; i++){
			
			// Loop through all cookie options
			let CookieString = CookiesTable[i]
			CookieString = CookieString.trim()

			let CookieMetadata = CookieString.split(";")
			for (let MetadataIndex = 0; MetadataIndex < CookieMetadata.length; MetadataIndex++){

				// Loop through all the metadata options
				let MetadataOption = CookieMetadata[MetadataIndex]
				MetadataOption = MetadataOption.trim()

				// Split by key, index at equals sign
				let CookieData = MetadataOption.split("=")
				let CookieKey = CookieData[0]
				let CookieValue = CookieData[1]

				if (DesiredKeys.includes(CookieKey)){
					CookiesData[CookieKey] = CookieValue
				} else if (CookieKey == "ASP.NET_SessionId"){
					SessionId = CookieValue
				}

			}
			
		}

	}

	// Save a copy
	if (CookiesData.AvxUserHash){
		SetAvx = CookiesData.AvxUserHash
	}
	if (CookiesData.AWSALBCORS){
		SetAwsalbcors = CookiesData.AWSALBCORS
	}
	if (CookiesData.AWSALB){
		SetAwsalb = CookiesData.AWSALB
	}

	// Update database
	Database.SetValue("CookiesData", CookiesData)

}

async function GetActivePeople() {

	let GetPeopleUrl = "https://vxp.noc.vmc.navblue.cloud/RaidoMobile/api/trade/rosters/human-resources-two-way?isSap=false"
	let Cookie = await GetCookie()

	return fetch(GetPeopleUrl,{
		method: "GET",
		headers: {
			'Cookie':Cookie,
			'Content-Type': "application/json",
		}
	})
	
}

async function GetScheduleForUser(BaseId, HRId) {

	let GetScheduleUrl = `https://vxp.noc.vmc.navblue.cloud/RaidoMobile/api/trade/rosters/6?tradeboardFilterOptionId=0&baseId=${BaseId || "0"}${HRId && `&hrId=${HRId}` || ""}&isSap=false`
	let Cookie = await GetCookie()

	return fetch(GetScheduleUrl, {
		method: 'GET',
		headers: {
			'Cookie': Cookie,
			'Content-Type': "application/json",
		}
	})

}

async function GetOperationsCredentials(AirportCode){

	let GetOperationsHtml = `https://vxp.noc.vmc.navblue.cloud/RaidoMobile/Dialogues/Operations/StationOperations.aspx`
	let Cookie = await GetCookie()

	let credentialsResponse = await fetch(GetOperationsHtml, {
		method: 'GET',
		headers: {
			'Cookie': Cookie,
			'Content-Type': "text/html; charset=utf-8",
		}
	})

	if (credentialsResponse.status != 200){
		return
	}

	let Text = await credentialsResponse.text()
	let root = parse(Text)

    let Viewstate = root.getElementById('__VIEWSTATE')
	Viewstate = Viewstate && Viewstate.getAttribute("value")

    let EventValidation = root.getElementById('__EVENTVALIDATION')
	EventValidation = EventValidation && EventValidation.getAttribute("value")

    let Generator = root.getElementById('__VIEWSTATEGENERATOR')
	Generator = Generator && Generator.getAttribute("value")

	let StationId
	if (AirportCode) {

		let ListElement = root.getElementById('MasterMain_ddlStation')
		if (ListElement){
			for (let i = 0; i < ListElement.childElementCount; i++){
				let ChildNode = ListElement.children[i]
				let IsTargetAirport = ChildNode.text.toLowerCase().startsWith(AirportCode.toLowerCase())
				if (IsTargetAirport){
					StationId = ChildNode.getAttribute("value")
					break
				}
			}
		}
		
	}

	let Rnd = root.getElementById('form')
	Rnd = Rnd && Rnd.getAttribute('action')
	Rnd = Rnd.split('=')[1]

	return {Viewstate: Viewstate,
			EventValidation: EventValidation,
			Generator: Generator,
			RND: Rnd,
			Text: Text,
			StationCode: StationId,
		}

}

async function GetStationOperations(AirportCode, DateObject) {

	let GetOperationsHtml = `https://vxp.noc.vmc.navblue.cloud/RaidoMobile/Dialogues/Operations/StationOperations.aspx`

	// Get time dates based on object
	let DateMonth = DateObject.getMonth()
	let MonthDay = DateObject.getDate()
	let Year = DateObject.getFullYear()

	// get DateFieldBox date
	let Months = [`JAN`,`FEB`,`MAR`,`APR`,`MAY`,`JUN`,`JUL`,`AUG`,`SEP`,`OCT`,`NOV`,`DEC`]
	let AbbreviatedMonth = Months[DateMonth]
	let HFDay = MonthDay
	if (HFDay < 10){
		HFDay = "0" + HFDay
	}
	
	let HFYear = Year.toString().slice(-2)
	let fieldBoxDate = `${HFDay}${AbbreviatedMonth}${HFYear}`
	
	// Get HF
	let HFMonth = DateMonth + 1
	if (HFMonth < 10){
		HFMonth = "0" + HFMonth
	}
	let hfDate = `${Year}${HFMonth}${HFDay}`

	let Credentials = await GetOperationsCredentials(AirportCode)
	let Viewstate = Credentials.Viewstate
	let Generator = Credentials.Generator
	let EventValidation = Credentials.EventValidation
	let StationCode = Credentials.StationCode
	let RND = Credentials.RND

	if (!Viewstate){
		return false, "no viewstate found"
	}

	let viewStateEncoded = `__VIEWSTATE=${encodeURIComponent(Viewstate)}&__VIEWSTATEGENERATOR=${encodeURIComponent(Generator)}&__EVENTVALIDATION=${encodeURIComponent(EventValidation)}`
	let OtherEncoding = `ctl00%24MasterMain%24tbDate%24hfMonthShortNames=JAN%2CFEB%2CMAR%2CAPR%2CMAY%2CJUN%2CJUL%2CAUG%2CSEP%2COCT%2CNOV%2CDEC&ctl00%24MasterMain%24tbDate%24hfWdMinNames=Su%2CMo%2CTu%2CWe%2CTh%2CFr%2CSa&ctl00%24MasterMain%24tbDate%24hfCalorder=dmy&ctl00%24MasterMain%24tbDate%24hfReadonly=&ctl00%24MasterMain%24tbDate%24hfMaxTwoDigitYear=2079&ctl00%24MasterMain%24tbDate%24hdnAllowEmptyDates=false&ctl00%24MasterMain%24tbDate%24DateFieldTextBox=${fieldBoxDate}&ctl00%24MasterMain%24tbDate%24hfDate=${hfDate}&ctl00%24MasterMain%24ddlStation=${StationCode}&ctl00%24MasterMain%24ddlSort=0&ctl00%24MasterMain%24TimeMode%24DP_TimeModes=2&ctl00%24MasterMain%24btnSearch=Search`
	
	// Fetch request
	let fullUrl = `${GetOperationsHtml}?rnd=${RND}`
	let body = `${viewStateEncoded}&${OtherEncoding}`
	let Cookie = await GetCookie()

	return fetch(fullUrl, {
		method: 'POST',
		body: body,
		headers: {
			'Cookie': Cookie,
			'Content-Type': "application/x-www-form-urlencoded",
		}
	})

}

async function getSchedule(id){
	let url = "https://vxp.noc.vmc.navblue.cloud/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetRoster"
	let table = {
		hrId: id,
		month: 8,
		year: 2025
	}

	let Cookie = await GetCookie()
	return fetch(url, {
		method: 'POST',
		body: JSON.stringify(table),
		headers: {
			'Cookie': Cookie,
			'Content-Type': "application/json",
		}
	})


}

export default {
	GetActivePeople() {
		return GetActivePeople()
	},

	GetScheduleForUser(BaseId, HRId) {
		return GetScheduleForUser(BaseId, HRId)
	},
	
	GetStationOperations(StationCode, Date) {
		return GetStationOperations(StationCode, Date)
	},

	GetOperationsCredentials(AirportCode){
		return GetOperationsCredentials(AirportCode)
	},

	GetSchedulePrimary(Id){
		return getSchedule(Id)
	},

	UpdateRequestData(Response){
		return UpdateRequestData(Response)
	},

};