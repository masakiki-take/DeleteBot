//----------------------------------------------------------------------------------------
// '予告済みファイル削除'または'削除予告' をします（deleteFlagでどちらかの機能が決定）
//----------------------------------------------------------------------------------------
function deleteOldFile(channelName,result,deleteFlag) {
  
  //指定したチャンネルの検索
  var channelId = existsId(channelName)
  if(!channelId){
    return postSlack(channelName +' は存在しません。')
  }
  
  var options = {
    channel: channelId,
    count: 1000
  }
  
  if (deleteFlag) {
    
    // 削除の実行
    filesList(options).files.forEach(function(val){
      
      var from = val.created
      //日付（先月を指定する）
      var n = DeleteMonth
      var to = new Date()
      to.setMonth(to.getMonth() + n )
      
      //削除対象日の検索
      var isDelete = dayCount(from,to) 
      
      //ファイル投稿してから現在までの経過日付 >= ユーザー指定日付
      if (isDelete) {
        
        //ファイルの削除の実行
        filesDelete(val.id)
        result.push(val.name)
      }
    })
  } else if(!deleteFlag) {
    
    //削除ファイルの通知
    filesList(options).files.forEach(function(val){
      
      var from = val.created
      var to = new Date
      
      //削除対象日の検索
      var isDelete = dayCount(from,to) 
      if (isDelete) {
        
        //通知対象を詰め込む
        var filesInfo = templateText(val,channelName)
        result.push(filesInfo)
      }
    })
  }
}

//----------------------------------------------------------
// SlackWebAPI　実行用
//----------------------------------------------------------
function getData(method,requestMethod,params) {
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
function channelNameToId(name) {
  
  var channelsList=getData("channels.list","GET",'')
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
function groupNameToId(name) {
  
  var groupsList=getData("groups.list","GET",'')
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
function filesDelete(file){
  
  var params = {
    'token': SLACK_ACCESS_TOKEN,
    'file': file,
  }
  var data = getData("files.delete","POST",params)
  return　data
}

//----------------------------------------------------------
// ファイルのリストを検索
//----------------------------------------------------------
function filesList(data){
  
  var params = {
    'token': SLACK_ACCESS_TOKEN,
    'channel': data.channel,
    'count': data.count,
    'types': FileType
  }
  
  var res = getData("files.list","POST",params)
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
  var result = channelNameToId(channelName) || groupNameToId(channelName)
  
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
function templateText(val,channelName) {
  
  var result = ''
  
  //ファイル名
  var filename = val.name
  
  //投稿月
  var created = new Date(val.created*1000) 
  created = dateToString(created)
  
  // ユーザー名
  var usersList = getData("users.list","GET",'')
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
  
  var fileInfo = getData('files.info',"GET",{'file': fileId}).file
  
  
  if (Object.keys(fileInfo.channels).length == 1 ){
  
    return getData('channels.replies',"GET", {
      'channel': fileInfo.channels[0],
      'thread_ts': fileInfo.shares.public[fileInfo.channels[0]][0].ts
    }).messages[0].text
    
  } else {
    
    // 複数チャネルに共有されている場合
    var channelNameList = [] 
    var commentList = fileInfo.channels.map(function(channel,i){
      Logger.log(channelNameList.push(fileInfo.shares.public[channel][0].channel_name))
      var data = getData('channels.replies',"GET", {
        'channel': fileInfo.channels[i],
        'thread_ts': fileInfo.shares.public[channel][0].ts
      }).messages[0].text
      return data
    })
    return commentList.join('')                     
  }
}