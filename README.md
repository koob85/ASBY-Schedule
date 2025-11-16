# Welcome to ASBY Scheduler!
See how to get started in depth:
https://docs.google.com/document/d/1tGxXGC6ICAQgjZqcLupNdqaqXt1RwU_mv3O4ja9-D8k/edit?usp=sharing

Get statrted TLDR:
1. This runs on JavaScript. Make sure you have Node.js installed
2. Update the following variables in Settings.js: MyBase, MyName, MyCredentials
3. Update the variables below: targetDay, targetMonth
4. To run the script, open the terminal and type 'node index.js'

Notes:
- You must be on reserve to run the code for the target month. 
  - This is because the code uses two-way-trades to fetch people's schedules
  - If you are not reserve, you cannot two-way-trade reserves and thus cannot view their schedule
- Two-way-trade list updates on the first of every month, so grabbing ASBY on the first of the month can only be done after 00:00 the same day
