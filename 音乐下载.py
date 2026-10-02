import requests
import json
iurl='https://c-ssl.dtstatic.com/uploads/blog/202012/08/20201208233524_40af5.thumb.400_0.jpeg'
iheaders={
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.'
}
response=requests.get(url=iurl,headers=iheaders)
data_music=json.loads(response.text)
print(data_music)




