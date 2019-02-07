//----------------------------------------------------------------------------------------
// '予告済みファイル削除'または'削除予告' をします（executeDeleteでどちらかの機能が決定）　
//----------------------------------------------------------------------------------------
function deleteOldFile(channelName,executeDelete) {
  
  // TODO:Support for alternative method
  
  //指定したチャンネルの検索
  var channelId = existsId(channelName)
  if(!channelId){
    return postSlack(channelName +' は存在しません。')
  }
  
  //削除対象リストを初期化
  var result = []
  
  var options = {
    channel: channelId,
    count: 1000
  }
  
  //本日の日付を取得
  var to = new Date()
  
  if (executeDelete) {
    
    // 削除の実行
    getFilesList(options).files.forEach(function(val){
      
      //日付（先月を指定する）
      to.setMonth(to.getMonth() + DeleteMonth )
      
      //削除対象日の検索
      var from = val.created
      var isDelete = dayCount(from,to) 
      
      //ファイル投稿してから現在までの経過日付 >= ユーザー指定日付
      if (isDelete) {
        Logger.log("isDelete-%s filename -- %s",isDelete,val.name)
        
        //ファイルの削除の実行
        deleteFile(val.id)
        result.push(val.name)
      }
    })
  } else if(!executeDelete) {
    
    //削除ファイルの通知
    getFilesList(options).files.forEach(function(val){
      
      var from = val.created
      
      //削除対象日の検索
      var isDelete = dayCount(from,to) 
      if (isDelete) {
        
        //通知対象を詰め込む
        var filesInfo = getFileCommentLog(val,channelName)
        result.push(filesInfo)
      }
    })
  }
  
  return result
}

//----------------------------------------------------------
// SlackWebAPI　実行用
//----------------------------------------------------------
function postData(method,requestMethod,params) {
  
  // TODO:Support for alternative method
  
  var url = ''
  var options = ''
  
  if ("GET" === requestMethod) {
    var extra = ''
    if(params) {
      
      extra = Object.keys(params).map(function(k) {
        return Utilities.formatString("&%s=%s", k, params[k])
      }).join('')
    }
    
    url = Utilities.formatString("%s%s?token=%s%s", APIBASEURL, method, SLACK_ACCESS_TOKEN, extra)
    options = {
      'method' : 'GET',    
      'contentType' : 'application/json charset=utf-8',
      'muteHttpExceptions' : true,
    }
    
  } else if ("POST" === requestMethod){
    
    url = Utilities.formatString("%s%s", APIBASEURL, method)
    options = {
      'method': 'POST',
      'muteHttpExceptions' : true,
      'payload': params
    }
  }
  
  var res = UrlFetchApp.fetch(url, options)
  //  Logger.log(JSON.parse(res.getContentText()))
  return JSON.parse(res.getContentText())
}

//----------------------------------------------------------
// チャンネル名を検索してIDを取得
//----------------------------------------------------------
function getChannelId(name) {
  
  var channelsList=postData("channels.list","GET")
  var foundChannelsId = ''
  var isFound = channelsList.channels.some(function(channels){
    if (channels.name.match(name)){
      foundChannelsId = channels.id
      return true
    } 
  })
  return foundChannelsId
}

//----------------------------------------------------------
// チャンネル名を検索してIDを取得（鍵有トークルーム用）
//----------------------------------------------------------
function getGroupId(name) {
  
  var groupsList=postData("groups.list","GET")
  var foundGroupsId = ''
  var isFound = groupsList.groups.some(function(groups){
    if (groups.name.match(name)){
      foundGroupsId = groups.id
      return true
    } 
  })
  return foundGroupsId
}

//----------------------------------------------------------
// ファイルの削除
//----------------------------------------------------------
function deleteFile(file){
  
  var params = {
    'token': SLACK_ACCESS_TOKEN,
    'file': file,
  }
  var data = postData("files.delete","POST",params)
  return　data
}

//----------------------------------------------------------
// ファイルのリストを検索
//----------------------------------------------------------
function getFilesList(data){
  
  var params = {
    'token': SLACK_ACCESS_TOKEN,
    'channel': data.channel,
    'count': data.count,
    'types': FileType
  }
  
  var res = postData("files.list","POST",params)
  return res
}

//----------------------------------------------------------
// Slackへ投稿
//----------------------------------------------------------
function postSlack(text) {
  
  // 投稿先チャンネル
  var url = SlackPostChannel
  var payload = {
    'text': text.replace(/'/g,'')
  }
  
  var options = {
    'method' : 'POST',
    'headers': {'Content-type': 'application/json'},
    'payload': JSON.stringify(payload)
  }
  
  UrlFetchApp.fetch(url, options)
}

//----------------------------------------------------------
// 対象となるチャンネルが存在するかチェック
//----------------------------------------------------------
function existsId(channelName) {
  
  //チャンネルの検索
  var result = getChannelId(channelName) || getGroupId(channelName)
  
  return result
}

//----------------------------------------------------------
// date -> 文字列変換(yyyyMMDD形式文字列で返す)
//----------------------------------------------------------
function dateToString(now) {
  return Utilities.formatDate(now, 'JST', 'yyyyMMdd')
}

//------------------------------------------------------------------------------------------------
// ファイル投稿日とユーザー指定された日付を比較します。（true:投稿日の方が大きい,false: 指定された日付の方が大きい）
//------------------------------------------------------------------------------------------------
function dayCount(from,to) {
  
  var result = false
  
  var from = new Date(from*1000)
  var to = new Date(to)
  
  var ms = to.getTime() - from.getTime()
  var targetDays = Math.floor(ms / (1000*60*60*24))
  
  
  if (targetDays >= DAYS) {
    
    result = true
  }
  return result
}

//----------------------------------------------------------
// ログのテンプレートを作成します
//----------------------------------------------------------
function getFileCommentLog(val,channelName) {
  
  var result = ''
  
  //ファイル名
  var filename = val.name
  
  //投稿月
  var created = new Date(val.created*1000) 
  created = dateToString(created)
  
  // ユーザー名
  var usersList = postData("users.list","GET")
  var foundUserName = '不明'
  usersList.members.some(function(users){
    if (users.id.match(val.user)){
      foundUserName = users.real_name
      return true
    } 
  })
  
  // コメント
  var foundComment = getFileComment(val.id)
  
  //データの整形
  var format = "[%s] - %s `%s` %s %s"
  result = Utilities.formatString(format,created,channelName,filename,foundUserName,foundComment)
  
  return result
}

//----------------------------------------------------------
// ファイル投稿時のコメントを取得します
//----------------------------------------------------------
function getFileComment(fileId) {
  
  var fileInfo = postData('files.info',"GET",{'file': fileId}).file
  
  if (Object.keys(fileInfo.channels).length == 1 ){
    
    return postData('channels.replies',"GET", {
      'channel': fileInfo.channels[0],
      'thread_ts': fileInfo.shares.public[fileInfo.channels[0]][0].ts
    }).messages[0].text
    
  } else {
    
    // 複数チャネルに共有されている場合
    var channelNameList = [] 
    var commentList = fileInfo.channels.map(function(channel,i){
      //      Logger.log(channelNameList.push(fileInfo.shares.public[channel][0].channel_name))
      return postData('channels.replies',"GET", {
        'channel': fileInfo.channels[i],
        'thread_ts': fileInfo.shares.public[channel][0].ts
      }).messages[0].text
    })
    
    return commentList.join("")         
  }
}