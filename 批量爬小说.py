import requests
from lxml import etree
import time
count=0
iurl='https://www.diandingnnn.cc/ddk92482/'
iheaders={
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.'
}
response=requests.get(url=iurl,headers=iheaders)
data=etree.HTML(response.text)
biaotis=data.xpath('//div[@class="listmain"]//dd/a/@href')
for biaoti in biaotis[12:22]:
    new_url='https://www.diandingnnn.cc'+biaoti
    new_response=requests.get(url=new_url,headers=iheaders)
    new_data=etree.HTML(new_response.text)
    new_biaoti=new_data.xpath('//h1/text()')
    new_zhengwen=new_data.xpath('//div[@id="content"]/text()')
    for i in new_zhengwen:
        with open(f'{new_biaoti}.txt','a',encoding='utf-8') as f:
            f.write(i)
            f.write('\n')
    count = count+1
    print(f'第{count}章已经下载完成')
    time.sleep(0.5)
