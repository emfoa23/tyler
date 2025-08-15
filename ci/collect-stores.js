import querystring from 'querystring'
import fs from 'fs'
import path from 'path'

const sidoList = [
  '서울',
  '경기',
  '부산',
  '대구',
  '인천',
  '대전',
  '울산',
  '강원',
  '충북',
  '충남',
  '광주',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
  '세종',
]

// 복권 판매점 정보 조회 API 호출 함수
const callSellerInfoAPI = async (sido, page) => {
  const response = await fetch('https://dhlottery.co.kr/store.do?method=sellerInfo645Result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept-Language': 'ko-KR',
    },
    body: querystring.stringify({
      nowPage: page,
      sltSIDO2: sido,
      sltGUGUN2: '',
      searchType: 3,
      rtlrSttus: '001',
    }),
  })

  // EUC-KR 응답을 Buffer로 받기
  const buffer = await response.arrayBuffer()

  // EUC-KR을 UTF-8로 변환
  const decoder = new TextDecoder('euc-kr')
  const utf8Text = decoder.decode(buffer)

  return JSON.parse(utf8Text)
}

// MongoDB 스키마에 맞게 데이터 매핑하는 함수
const mapToMongoSchema = ({
  RTLRID,
  FIRMNM,
  BPLCLOCPLC1,
  BPLCLOCPLC2,
  BPLCLOCPLC3,
  BPLCLOCPLCDTLADRES,
  BPLCDORODTLADRES,
  LATITUDE,
  LONGITUDE,
  RTLRSTRTELNO,
}) => ({
  storeId: RTLRID,
  storeName: FIRMNM,
  roadAddress: BPLCDORODTLADRES,
  location: {
    sido: BPLCLOCPLC1,
    sigungu: BPLCLOCPLC2,
    dong: BPLCLOCPLC3,
    detailAddress: BPLCLOCPLCDTLADRES,
  },
  coordinates: {
    latitude: LATITUDE,
    longitude: LONGITUDE,
  },
  phoneNumber: RTLRSTRTELNO,
})

// 특정 시도의 모든 지점을 수집하는 함수
const collectSellerInfoBySido = async (sido) => {
  let page = 1
  let allStores = []

  // 다음 페이지가 없을 때까지 루프
  while (true) {
    const { arr, totalPage } = await callSellerInfoAPI(sido, page)

    // 0.1초 sleep
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 현재 페이지의 지점들을 allStores에 추가
    allStores = [...allStores, ...arr]

    if (page === totalPage) {
      break
    }

    page++
  }

  return allStores
}

// 수집된 판매점 정보를 파일로 저장하는 함수
const saveStoreListToFile = (storeList) => {
  try {
    // 현재 작업 디렉토리에 파일 저장
    const filepath = path.join(process.env.OUT_DIR, `lottery-stores.json`)
    fs.writeFileSync(filepath, JSON.stringify(storeList), 'utf8')

    console.log(`💾 전체 데이터 저장 완료: ${filepath}`)
    console.log(`📊 총 ${storeList.length}개 판매점 정보 저장됨`)
  } catch (error) {
    console.log(`❌ 파일 저장 중 오류 발생: ${error.message}`)
  }
}

// 메인 실행 함수
const main = async () => {
  const allStoreList = []

  for (const sido of sidoList) {
    try {
      console.log(`📡 ${sido} 복권 판매점 정보 수집 중...`)

      // 특정 시도의 모든 지점 수집
      const rawStoreList = await collectSellerInfoBySido(sido)

      // map을 이용해 MongoDB 스키마로 파싱
      const mappedStoreList = rawStoreList.map(mapToMongoSchema)

      // 전체 리스트에 추가
      allStoreList.push(...mappedStoreList)

      console.log(`✅ ${sido}: 총 ${mappedStoreList.length}개 지점 수집 완료`)
    } catch (error) {
      console.log(`❌ ${sido}: 오류 발생 - ${error.message}`)
    }
  }

  // 모든 데이터를 저장
  saveStoreListToFile(allStoreList)
}

// 스크립트 실행
main()
