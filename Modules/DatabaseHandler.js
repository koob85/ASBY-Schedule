// Actual database
let fs = require("fs")

let DatabasePath = ".//Database.json"
let DatabaseStringModifier = "utf8"
let ModifyingJson = false

function GetDataWithScope(Scope){

	getPromise = new Promise(function(myResolve, myReject){

		let dataPromise = GetAllData()
		dataPromise.then((Data) =>{

			if (!Data){
				myReject("Failed to get data")
			}

			scopeName = GetScopeName(Scope)
			let DataWithScope = Data[scopeName]
			myResolve(DataWithScope || {})
		})
		dataPromise.catch(myReject)
	})

	return getPromise
}

function WriteToFile(Data){

	let WritePromise = new Promise(function(myResolve, myReject){

		let jsonString
		try {
			jsonString = JSON.stringify(Data)
		} catch (JsonError) {
			myReject(JsonError)
		}	

		// Double check json string
		try {
			let Data = JSON.parse(jsonString)
		} catch (Error) {
			myReject("Malformed json stringified value")
		}

		if (ModifyingJson){
			//myReject("Writing to json too quickly")
		}

		ModifyingJson = true

		fs.writeFile(DatabasePath, jsonString, err => {
			ModifyingJson = false
			if (err) {
				myReject(err)
			} else {
				// Double check?
				myResolve(Data)
			}
		})
	})

	return WritePromise

}

function SaveData(Scope, ScopeData){
	savePromise = new Promise(function(myResolve, myReject){
		
		if (!Scope){
			myReject("Scope not passed to save")
		}

		if(!ScopeData){
			myReject("Scope data not valid")
		}
		
		let dataScope = GetAllData()
		dataScope.then(Data => {

			// Set
			Data[Scope] = ScopeData
			
			// Save to file
			try { 
				WriteToFile(Data)
					.catch(myReject)
					.then(myResolve)
			} catch {
				myReject("failed to write to json database")
			}

		})
		dataScope.catch(reason => {
			myReject(reason)	
		})

	})
	return getPromise
}

function GetAllData(){
	getPromise = new Promise(function(myResolve, myReject){
		try {

			if (ModifyingJson){
				//myReject("Reading json too quickly")
			}

			ModifyingJson = true

			fs.readFile(DatabasePath, DatabaseStringModifier, function(err,data){

				ModifyingJson = false 

				if (err){
					myReject(error)
				}
				
				let Data
				try {
					Data = JSON.parse(data)
				} catch (error) {
					myReject(error)
				}
				
				myResolve(Data)
				
			})

		} catch (error) {
			myReject(error)
		}
	})
	return getPromise
}

function GetScopeName(ScopeName){
	return typeof(ScopeName) == "string" && ScopeName || "Default"
}

module.exports = {
	
	GetData(Scope){
		return GetDataWithScope(Scope)
	},
	
	GetValue(Key,Scope){
		GetPromise = new Promise(function(myResolve, myReject){
			GetDataWithScope(Scope)
			.then((Data) => {
				myResolve(Data[Key])
			})
			.catch(myReject)
		})
		return GetPromise
	},
	
	SetValue(Key,Value,Scope){
		
		SetPromise = new Promise(function(myResolve, myReject){

			if (!Key){
				myReject("Key is invalid")
			}
			
			scopeName = GetScopeName(Scope)

			GetDataWithScope(Scope)
				.then((Data) => {
					
					if (!Data){
						myReject("Data not found")
					}

					if (Value == null){
						delete Data[Key]
					} else {
						Data[Key] = Value
					}

					SaveData(scopeName,Data)
						.then(myResolve)
						.catch(myReject)
				.catch(error => {
					myReject(error)
				})
			});

		})

		return SetPromise

	}
	
}
