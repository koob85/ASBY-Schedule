module.exports = {
	GetTime: function(Timestamp){

		let Hour = Timestamp.getHours()
		let Minute = Timestamp.getMinutes()

		if (Minute < 10){
			Minute = "0" + Minute
		}

		if (Hour < 10){
			Hour = "0" + Hour
		}

		return `${Hour}:${Minute}`

	},
};