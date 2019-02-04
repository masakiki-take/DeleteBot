// スプレッドシートを取得
var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
var sheet = spreadsheet.getSheetByName('設定ファイル')

//api トークン
var SLACK_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("TOKEN")

//api URL
var APIBASEURL = "https://slack.com/api/"

//Slack投稿先チャンネル
var SlackPostChannel = PropertiesService.getScriptProperties().getProperty("POSTCHANNEL")

//削除対象チャンネル一覧
var targetChannels = sheet.getRange('B2').getValues().toString().split(",")

//削除対象日
var DAYS = sheet.getRange('B3').getValues().toString()

//ファイルの種類
var FileType = sheet.getRange('B4').getValues().toString()

//削除月の設定
var DeleteMonth = sheet.getRange('B11').getValues().toString()

//ファイルサイズ単位
var units = [" B", " KB", " MB", " GB", " TB"]

// エラーメッセージ出力セル
var errorFileDeleteExecutioner = sheet.getRange("B23")
var errorDeleteAnnounceExecutioner = sheet.getRange("B24")
var errorAnnounceInUseStorageExecutioner = sheet.getRange("B25")


//----------------------------------------------------------------------
// 先月削除予告済みのファイルを削除します（指定チャンネル内）
//----------------------------------------------------------------------
function fileDeleteExecutioner(){
  
  const deleteFlag = true
  var result = [] //削除対象リスト
  
  try {
    
    // エラー出力セル初期化処理
    errorFileDeleteExecutioner.setValue("")
    
    for (var i in targetChannels) {
      deleteOldFile(targetChannels[i],result,deleteFlag)
    }
    
    if(result.length != 0) {
      
      var text = sheet.getRange('B12').getValues().toString()
      return postSlack(text)
    } else {
      
      var text = sheet.getRange('B13').getValues().toString()
      return postSlack(text)
    }
  }catch (e) {
    Logger.log(e)
    errorFileDeleteExecutioner.setValue(e)
  }
}

//----------------------------------------------------------
// 翌月削除対象のファイルをスラックに通知します
//----------------------------------------------------------
function deleteAnnounceExecutioner(){
  
  const deleteFlag = false
  var result = [] //削除対象リスト
  
  try {
    
    // エラー出力セル初期化処理
    errorDeleteAnnounceExecutioner.setValue("")
    
    //削除予定ファイルの検索
    for (var i in targetChannels) {
      deleteOldFile(targetChannels[i],result,deleteFlag)
    }
    
    //日付（翌月を指定する）
    var n = 1
    var date   = new Date()
    date.setMonth(date.getMonth() + n )
    date = dateToString(date).substring(0,6)
    
    if(result.length != 0) {
      
      // 削除予告ありの場合は削除対象ファイル名を配列に詰め込む
      var text = sheet.getRange('B7').getValues().toString()
      var regExp = new RegExp("@", 'g') 
      var str = text.replace( regExp , date)
      result.unshift(str) 
      
      result.forEach(function(val){
        postSlack(val)
      })
      
    } else {
      
      // 削除予告なしの場合は削除対象がないことを投稿する
      var text =  sheet.getRange('B6').getValues().toString()
      var regExp = new RegExp("@", 'g') 
      var str = text.replace( regExp , date) 
      postSlack(str)
    }
  }catch (e) {
    Logger.log(e)
    errorDeleteAnnounceExecutioner.setValue(e)
  }
}

//----------------------------------------------------------
// 現在のワークスペースのストレージ使用量を通知します
//----------------------------------------------------------
function announceInUseStorageExecutioner() {
  
  try {
    
    // エラー出力セル初期化処理
    errorAnnounceInUseStorageExecutioner.setValue("")
    
    var params = {
      'token': SLACK_ACCESS_TOKEN,
      'count': "1000",
      'types': "all"
    }
    var options = {
      'method': 'POST',
      'payload': params
    }
    var res = UrlFetchApp.fetch('https://slack.com/api/files.list',options)
    res = JSON.parse(res.getContentText())
    
    var filesize = 0
    
    // ワークスペースの全てのファイルサイズを取得
    res.files.forEach(function(val){
      filesize+=val.size
    })
    
    //変換処理
    for (var i= 0; filesize > 1024; i++) {
      filesize /= 1024
    }
    
    // 対象ファイルが存在する場合は、使用量を通知する
    if (filesize !== 0 ){
      
      filesize = Math.round(filesize * 100) / 100 + units[i]
      var text =  sheet.getRange('B16').getValues().toString()
      var regExp = new RegExp("@", 'g')
      var str = text.replace( regExp , filesize)
      
      postSlack(str)
    }
    
  }catch (e) {
    Logger.log(e)
    errorAnnounceInUseStorageExecutioner.setValue(e)
  }
}


