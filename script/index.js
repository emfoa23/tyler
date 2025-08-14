import querystring from 'querystring'

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

    // 0.5초 sleep
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

// 메인 실행 함수
const main = async () => {
  for (const sido of sidoList) {
    try {
      console.log(`📡 ${sido} 복권 판매점 정보 수집 중...`)

      // 특정 시도의 모든 지점 수집
      const rawStores = await collectSellerInfoBySido(sido)

      // map을 이용해 MongoDB 스키마로 파싱
      const mappedStores = rawStores.map(mapToMongoSchema)

      console.log(`✅ ${sido}: 총 ${mappedStores.length}개 지점 수집 완료`)
    } catch (error) {
      console.log(`❌ ${sido}: 오류 발생 - ${error.message}`)
    }
  }
}

// 스크립트 실행
main()
