import { en } from "@/messages/en";
import { ko } from "@/messages/ko";
import type { LocaleCode } from "@/types/market";

export type Messages = {
  common: {
    continueShopping: string;
    backToHome: string;
    loading: string;
  };
  footer: {
    terms: string;
    privacy: string;
    shippingPolicy: string;
    returnPolicy: string;
    businessInfoPlaceholder: string;
  };
  home: {
    bestProducts: string;
    discountProducts: string;
    overseasProducts: string;
    domesticProducts: string;
    promotion: string;
    category: string;
    more: string;
  };
  market: {
    selectorTitle: string;
    change: string;
  };
  toast: {
    addedToCart: string;
    viewCart: string;
    optionRequired: string;
    outOfStock: string;
  };
  product: {
    outOfMarketShort: string;
    freeShipping: string;
    tabInfo: string;
    tabReview: string;
    tabInquiry: string;
    tabShipping: string;
    buyNow: string;
    descriptionHeading: string;
    featuresHeading: string;
    specsHeading: string;
    noticeHeading: string;
    defaultDescription: string;
    feature1: string;
    feature2: string;
    feature3: string;
    noticeText: string;
    specCategory: string;
    specShippingType: string;
    specComposition: string;
    specCompositionValue: string;
    specOrigin: string;
    fallbackCategoryLabel: string;
    totalCount: string;
    soldOut: string;
    optionSoldOut: string;
    selectVariantPrompt: string;
    optionCombinationSoldOut: string;
    basePriceLabel: string;
    optionPriceLabel: string;
    finalPriceLabel: string;
    totalPriceLabel: string;
    purchaseSelectionPending: string;
    stockRemaining: string;
  };
  shippingExchange: {
    shippingMethod: string;
    shippingPeriod: string;
    shippingFee: string;
    exchangeCondition: string;
    exchangeConditionValue: string;
    returnCondition: string;
    returnConditionValue: string;
    overseasDirectNoticeTitle: string;
    overseasDirectNoticeBody: string;
    overseasAgencyNoticeTitle: string;
    overseasAgencyNoticeSuffix: string;
  };
  cart: {
    title: string;
    empty: string;
    selectAll: string;
    itemCount: string;
    groupDomestic: string;
    groupOverseasDirect: string;
    groupOverseasAgency: string;
    remove: string;
    unavailableInMarket: string;
    itemsTotal: string;
    discountTotal: string;
    shippingTotal: string;
    grandTotal: string;
    checkoutButton: string;
    checkoutPlaceholder: string;
    unavailableItem: string;
    priceChanged: string;
    previousPrice: string;
  };
  checkout: {
    pageTitle: string;
    itemsSection: string;
    customerSection: string;
    addressSection: string;
    customsSection: string;
    customsNotice: string;
    customsCodeLabel: string;
    paymentSection: string;
    agreementText: string;
    submitButton: string;
    total: string;
    blockedTitle: string;
    backToCart: string;
    marketChangedNotice: string;
    emptyTitle: string;
    couponLabel: string;
    couponEmpty: string;
    pointsLabel: string;
    pointsLoginRequired: string;
    optionalTag: string;
    loginHint: string;
    loginLink: string;
    orderFailed: string;
    priceNotReady: string;
    stockChanged: string;
    priceMismatch: string;
    orderShippingUnavailable: string;
    orderShippingPending: string;
    invalidAddress: string;
    cartChanged: string;
    unauthorizedOrder: string;
    optionSectionLabel: string;
    priceChangedBadge: string;
    unavailableBadge: string;
    shippingCalculated: string;
    shippingFree: string;
    shippingUnavailable: string;
    shippingPending: string;
    totalPending: string;
  };
  order: {
    completeTitle: string;
    completeMessage: string;
    orderNumber: string;
    orderDate: string;
    total: string;
    viewOrders: string;
    lookupTitle: string;
    lookupOrderId: string;
    lookupContact: string;
    lookupSubmit: string;
    lookupNotFound: string;
    claimOrdersCta: string;
  };
  auth: {
    pageTitle: string;
    continueWithGoogle: string;
    continueWithKakao: string;
    continueWithNaver: string;
    continueWithEmail: string;
    socialComingSoon: string;
    backToProviders: string;
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    signIn: string;
    signUp: string;
    signOut: string;
    invalidEmail: string;
    invalidPassword: string;
    invalidCredentials: string;
    unknownError: string;
    passwordMismatch: string;
    nameRequired: string;
    duplicateEmail: string;
    signupCheckEmail: string;
    termsRequired: string;
    agreeAll: string;
    agreeTerms: string;
    agreePrivacy: string;
    agreeMarketing: string;
    switchToSignup: string;
    switchToLogin: string;
    providerEmail: string;
    viewDetails: string;
  };
  mypage: {
    pageTitle: string;
    orderHistory: string;
    trackShipment: string;
    wishlist: string;
    reviews: string;
    inquiries: string;
    profile: string;
    noOrders: string;
    signedUpWith: string;
    comingSoon: string;
  };
  nav: {
    menu: string;
    myPage: string;
    cart: string;
    wishlist: string;
    back: string;
    searchPlaceholder: string;
    imageSearch: string;
  };
  localeSelector: {
    title: string;
    ko: string;
    en: string;
  };
  currencySelector: {
    title: string;
    krw: string;
    inr: string;
    usd: string;
  };
  search: {
    pageTitle: string;
    enterKeyword: string;
    resultsFor: string;
    resultsCount: string;
    noResults: string;
    noResultsForQuery: string;
    noMatchingFilters: string;
    recommendedForYou: string;
    recentSearches: string;
    clearAll: string;
    removeOne: string;
    popularSearches: string;
    recommendedSearches: string;
    searching: string;
    noSuggestions: string;
    filter: string;
    sort: string;
    sortRecommended: string;
    sortPopular: string;
    sortPriceLow: string;
    sortPriceHigh: string;
    sortReviews: string;
    sortLatest: string;
    shippingType: string;
    priceRange: string;
    minPrice: string;
    maxPrice: string;
    discountOnly: string;
    reset: string;
    apply: string;
    priceUnder10k: string;
    price10kTo30k: string;
    price30kTo50k: string;
    priceOver50k: string;
    shippableOnly: string;
    loadMore: string;
    imageSearchTitle: string;
    imageSearchDevNotice: string;
    imageSearchComingSoon: string;
    imageSearchComingSoonHint: string;
    takePhoto: string;
    chooseFromGallery: string;
    dragDropHint: string;
    searchByImage: string;
    imageFallbackMessage: string;
    invalidImageType: string;
    invalidImageExtension: string;
    imageTooLarge: string;
    goToTextSearch: string;
    viewAllResults: string;
    imageSearchFailed: string;
    clearImage: string;
    imagePreviewAlt: string;
  };
  shipping: {
    domestic: string;
    overseasDirect: string;
    overseasAgency: string;
    estimatedDays: string;
  };
  payment: {
    methods: {
      card: string;
      easyPay: string;
      bankTransfer: string;
      upi: string;
      netBanking: string;
      wallet: string;
    };
    methodLabel: string;
    statusLabel: string;
    status: {
      pending: string;
      paid: string;
      failed: string;
      cancelled: string;
      refunded: string;
    };
    prepareFailed: string;
    confirmFailed: string;
    amountMismatch: string;
    stockChangedAtPayment: string;
  };
  orderStatus: Record<
    | "ORDER_CREATED"
    | "PAYMENT_PENDING"
    | "PAID"
    | "PREPARING"
    | "PARTIALLY_SHIPPED"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "RETURN_REQUESTED"
    | "RETURNED"
    | "REFUNDED",
    string
  >;
  shippingStatus: Record<
    "PREPARING" | "PURCHASING" | "READY_TO_SHIP" | "SHIPPED" | "IN_TRANSIT" | "CUSTOMS" | "OUT_FOR_DELIVERY" | "DELIVERED",
    string
  >;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  address: {
    kr: {
      recipientName: string;
      phone: string;
      postcode: string;
      address: string;
      addressDetail: string;
      deliveryMemo: string;
    };
    in: {
      fullName: string;
      mobileNumber: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      selectState: string;
      pinCode: string;
      deliveryInstructions: string;
    };
    optionalTag: string;
  };
  validation: {
    required: string;
    invalidPhone: string;
    invalidPostcode: string;
    customsCodeRequired: string;
    customsCodeInvalid: string;
    paymentMethodRequired: string;
  };
  error: {
    loadFailed: string;
    tryAgain: string;
  };
  review: {
    title: string;
    empty: string;
    helpful: string;
    sortLatest: string;
    sortRatingHigh: string;
    sortRatingLow: string;
    sortHelpful: string;
    withPhotoOnly: string;
    writeReview: string;
    writePlaceholder: string;
    submit: string;
    submitting: string;
    cancel: string;
    loginRequired: string;
    noMatching: string;
    totalCount: string;
    starLabel: string;
  };
  inquiry: {
    title: string;
    empty: string;
    writeInquiry: string;
    answered: string;
    waiting: string;
    secret: string;
    countLabel: string;
    writePlaceholder: string;
    loginRequired: string;
  };
  notice: {
    title: string;
    empty: string;
    pinned: string;
  };
  faq: {
    title: string;
    empty: string;
  };
  coupon: {
    title: string;
    none: string;
    availableCount: string;
    applied: string;
    remove: string;
    codePlaceholder: string;
    apply: string;
    codeRequired: string;
    applyFailed: string;
  };
  points: {
    label: string;
    balance: string;
    use: string;
    usePlaceholder: string;
    useAll: string;
    exceedsBalance: string;
    minUse: string;
    maxUse: string;
    conditionError: string;
    krwOnly: string;
  };
  a11y: {
    cart: string;
    wishlist: string;
    backButton: string;
    menu: string;
    cameraSearch: string;
    clearSearch: string;
    removeRecentSearch: string;
    share: string;
    decreaseQuantity: string;
    increaseQuantity: string;
    viewImageAt: string;
    goToBanner: string;
  };
};

const MESSAGES: Record<LocaleCode, Messages> = { ko, en };

export function getMessages(locale: LocaleCode): Messages {
  return MESSAGES[locale];
}

export function t(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );
}
